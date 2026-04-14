# Mobile App Discovery Note — AG-MOB-00

**Date:** 2026-04-13
**Phase:** MOB-00 — Discovery and Safety Review
**Status:** ✅ Complete

---

## 1. Production Environment

| Item | Finding |
|---|---|
| Production domain | `https://maf-psi.vercel.app` — confirmed |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` — public env var, safe for APK |
| Supabase anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public env var, safe for APK |
| Service-role key | `SUPABASE_SERVICE_ROLE_KEY` — server-only, never in `NEXT_PUBLIC_*`, safe |

The two public env vars are already prefixed `NEXT_PUBLIC_` which means they are
intentionally safe for client exposure. They can be embedded in the Expo mobile
config (`app.config.ts` / `.env`) without risk.

The service-role key is used only in `src/lib/supabase-admin.ts` with an explicit
comment: *"only use in server-side code / scripts, never expose to the browser."*
It will never appear in the APK.

---

## 2. Auth Flow Analysis

### Web app auth (cookie-based)
- `supabase-server.ts` uses `@supabase/ssr` `createServerClient` with a Next.js
  cookie adapter — session is stored in HTTP cookies, refreshed by middleware.
- `middleware.ts` calls `supabase.auth.getUser()` on every request to refresh the
  session silently.
- `auth.ts` wraps `getUser()` (not `getSession()` — secure pattern already in place).
- Auth redirects to `/login` when session is missing; redirects to `/company` when
  already logged in.

### Mobile app auth (token-based — required approach)
- The cookie mechanism **cannot be used** in React Native — there is no browser
  cookie store.
- The mobile app must use `@supabase/supabase-js` configured with a React Native
  storage adapter (`@react-native-async-storage/async-storage`).
- Required options at client creation:
  ```ts
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    }
  }
  ```
- `react-native-url-polyfill` must be imported before the Supabase client on React
  Native (required by the Supabase JS client URL parser).
- Use React Native `AppState` to pause/resume token refresh when the app
  backgrounds: call `supabase.auth.startAutoRefresh()` on foreground and
  `supabase.auth.stopAutoRefresh()` on background.
- The `users.is_active` check must be performed after login by fetching the user
  profile and blocking inactive users before navigating to the home screen.

### Mobile API endpoint token validation
- Each `/api/mobile/...` endpoint on Vercel receives the Supabase access token in
  the `Authorization: Bearer <token>` header.
- Endpoints validate it with the server Supabase client:
  ```ts
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  ```
- This is the standard pattern — no new auth infrastructure needed.

---

## 3. Work Inbox Data Source

### `src/actions/work-inbox.ts`

This is a `'use server'` function — **it cannot be called directly from the APK.**
A dedicated mobile API endpoint must wrap it.

The function `getWorkInboxData(projectId?)`:
- Runs 10 Supabase queries in parallel (all read-only).
- Produces a sorted, normalized `WorkInboxItem[]` with computed `ageDays` and
  `priority`.
- Returns a `WorkInboxData` object with `items` and `counts`.

**Reuse strategy:**
- Extract the core query + adapter logic into a shared utility function that
  accepts an already-authenticated Supabase client.
- The mobile endpoint (`GET /api/mobile/critical-actions`) calls this shared
  utility after validating the bearer token.
- This avoids duplicating the 10-query aggregation in a second location.

### `src/lib/work-inbox-types.ts`

The DTO contract is **frozen** (marked `WI-00: Contract frozen`). This is ideal —
the mobile API will return the same `WorkInboxItem` shape. No new fields will be
added without a formal review.

Key fields available for mobile display:
| Field | Use |
|---|---|
| `id` | unique item key |
| `type` | category/icon selection |
| `title` | primary label |
| `subtitle` | secondary label (supplier / project name) |
| `amount` + `currency` | financial summary |
| `statusLabel` | current status text |
| `actionLabel` | call-to-action text |
| `priority` | `critical / high / normal` → color + sort |
| `ageDays` | age badge |
| `dueAt` | overdue indicator |
| `projectName` + `projectCode` | project context |
| `badges` | tags |

The `href` field is web-app-specific and **should not be forwarded to the mobile
app** — mobile navigation uses its own screen routing.

Priority rules (from `work-inbox-types.ts`):
- `normal`: 0–6 days
- `high`: 7–13 days
- `critical`: 14+ days
- Promotion: if `dueAt` is overdue, promote one level (cap: `critical`)

---

## 4. Critical Actions Page Architecture

The web page at `/company/critical-actions`:
- Is a Next.js Server Component (`page.tsx`) that calls `getWorkInboxData()` and
  passes the result to `CriticalActionsClient`.
- `CriticalActionsClient` is a `'use client'` component providing filter controls,
  section grouping, refresh, and collapse state.
- **No approval or mutation actions exist on this page** — it is read/navigate-only
  in the current web implementation.
- Visual sections group items by type: Critical / Pending Approval / Receipt & Match
  / Internal Operations.

**Mobile V1 conclusion:** Critical Actions mobile V1 is **read-only**. There are no
server-side quick-action endpoints to reuse today. Quick actions (approve/reject)
will be added in MOB-05 when the relevant server actions are identified and wrapped.

---

## 5. Decisions Resolved

| Decision | Resolution |
|---|---|
| Mobile folder path | `mobile-app/` at repo root (keeps monorepo-style separation without requiring workspace changes) |
| Mobile framework | React Native + Expo (SDK 52 or latest stable at time of MOB-01) |
| Mobile API location | New endpoints under `src/app/api/mobile/` in the existing Next.js app on Vercel |
| Bearer token validation | `supabase.auth.getUser(token)` in each endpoint handler |
| Critical Actions V1 scope | Read-only — list, detail, filters, priority grouping. No write actions in V1. |
| Push notification service | Expo Push Service first (simpler, no FCM credentials needed in V1). Direct FCM only if Expo Push proves limiting. |
| Push token scaffold | Register in MOB-01 scaffold; server registration endpoint in MOB-03 |
| Offline cache library | TanStack Query (`@tanstack/react-query`) with AsyncStorage persistence via `@tanstack/query-async-storage-persister` |
| Offline cache policy | Cache last successful `/api/mobile/critical-actions` response; show stale data with `lastSyncedAt` banner when offline or refresh fails; disable write actions while offline |
| Version/update strategy | `versionCode` + user-facing `version` in `app.config.ts`; `/api/mobile/version` endpoint returns `currentVersion`, `minSupportedVersion`, `updateMessage`; app warns on newer, blocks below minimum; EAS Update for JS-layer-only changes |
| EAS account/build profile | To be confirmed by user — see §6 below |
| Barcode scanning | Backlog only — not in V1. If added, use Expo Camera barcode API (not deprecated `expo-barcode-scanner`). |

---

## 6. Open Items Requiring User Input

> **Action required before MOB-01 starts.**

### 6.1 EAS Account
- Who owns / will own the Expo/EAS account for this project?
- Is there an existing Expo project slug or will a new one be created?
- Does the user have `eas-cli` installed, or should Antigravity install and configure it?

### 6.2 Android Package ID
- Suggested: `com.maf.mobile` — confirm or provide the preferred package identifier.

### 6.3 App Name
- Suggested: `MAF` — confirm the user-facing app name in Arabic and English.

### 6.4 APK Signing
- For the first manual-install preview APK, EAS can generate a keystore automatically.
- For production distribution, a specific keystore may be required.
- Confirm whether Antigravity should let EAS auto-generate the keystore for the preview profile.

---

## 7. Next Phase

**MOB-01 — Mobile Project Scaffold** is unblocked except for the items in §6 above.

MOB-01 will:
1. Create `mobile-app/` with Expo + TypeScript + Expo Router
2. Configure `app.config.ts`, `eas.json`, and a preview APK build profile
3. Set up the Supabase RN client with AsyncStorage adapter
4. Scaffold TanStack Query with AsyncStorage persistence
5. Register `expo-notifications` push token scaffold (register after login, store locally)
6. Set `versionCode: 1`, `version: "1.0.0"`, and `runtimeVersion` in `app.config.ts`

> All items in §6 should be resolved before or during MOB-01 so that `eas.json`
> and `app.config.ts` are committed with final values.
