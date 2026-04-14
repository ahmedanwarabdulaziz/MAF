# Mobile App Plan

## Document Role

This document defines the phased implementation plan for a separate Android mobile app for the MAF system.

The mobile app must be treated as a separate product surface from the current web application. It may share the same business data, users, permissions, storage, and live Supabase project, but it must not reuse the desktop web interface as its main UI.

This document is intended for Antigravity to follow phase by phase.

## 1. Core Direction

Build a separate native-capable Android app that uses the live production system.

Recommended starting direction:

- create a separate mobile project, preferably under `apps/mobile` or `mobile-app`
- use React Native with Expo unless a later requirement proves Kotlin/native Android is necessary
- build APKs for manual Android installation
- use EAS Build for Android APK generation
- use the live production backend and Supabase project, not localhost
- keep the current web app working unchanged

The mobile app should be able to add mobile-only features over time, including camera capture, GPS capture, uploads, quick actions, barcode scanning, and push notifications.

Critical Actions is an alert/inbox surface, so push notification registration should be scaffolded early even if server-side notification sending is deferred.

## 2. Current System Findings

The current app is a Next.js 14 application deployed online on Vercel.

The database/auth/storage layer is Supabase:

- browser Supabase client: `src/lib/supabase.ts`
- server Supabase client: `src/lib/supabase-server.ts`
- admin/service client: `src/lib/supabase-admin.ts`
- auth helpers: `src/lib/auth.ts`
- middleware session refresh/protection: `src/middleware.ts`

Current login uses Supabase email/password auth:

- login screen: `src/app/(auth)/login/page.tsx`
- login call: `supabase.auth.signInWithPassword({ email, password })`
- protected pages rely on Supabase session cookies in the web app

Important implication:

The web app works online, but most business features are implemented as Next server components, server actions, and Supabase queries. A separate Android APK cannot safely depend on internal web server actions as its only integration surface. Antigravity must create or formalize a mobile API boundary where needed.

## 3. First Mobile Product Scope

The first mobile screen after login should be the mobile version of:

`/company/critical-actions`

This is currently the Work Inbox / Critical Actions Center.

The mobile V1 should focus on:

- login
- critical actions home
- pending item list
- priority filters
- item detail view
- quick approve/review actions where existing rules are clear
- attachment capture/upload where needed
- GPS capture where needed

The first version should not attempt to rebuild the entire system.

## 4. Architecture Decision

Use this architecture:

```text
Current Web App on Vercel
        |
        | Supabase Auth / server actions / API
        v
Live Supabase Project ---> PostgreSQL Database + Storage
        ^
        | Supabase Auth + mobile API endpoints
        |
Android Mobile App APK
```

The APK must not contain service-role credentials or database passwords.

Acceptable mobile access paths:

- Supabase Auth from the mobile app using the public Supabase URL and anon key
- mobile API endpoints under the live Vercel app, such as `/api/mobile/...`
- Supabase Storage uploads using authenticated user tokens and strict policies

Avoid:

- putting `SUPABASE_SERVICE_ROLE_KEY` in the APK
- connecting directly to Postgres from the APK
- copying desktop-only page logic into mobile screens
- bypassing current permission or approval rules

## 5. Recommended Integration Model

Use a hybrid model:

1. Mobile app signs in directly with Supabase email/password auth.
2. Mobile app stores the Supabase access/refresh tokens securely on Android.
3. Mobile app calls dedicated mobile API endpoints on the live Vercel domain for business workflows.
4. Mobile API endpoints validate the Supabase bearer token before returning or changing data.
5. Mobile API endpoints reuse existing server-side business logic where possible.
6. Direct Supabase reads from the mobile app are allowed only for simple, well-protected data covered by RLS.
7. Mobile app registers an Expo push token after login and sends it to the server.
8. Mobile app caches the last successful Critical Actions payload with a `lastSyncedAt` timestamp.
9. Mobile app checks app/API compatibility at startup so manually installed APKs do not silently become outdated.

Reason:

This avoids exposing server secrets while preventing the mobile app from duplicating fragile business logic.

## 6. Phase MOB-00 - Discovery and Safety Review ✅ DONE

- Phase ID: `MOB-00`
- Title: Discovery and Safety Review
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Goal:
  - confirm current app structure, auth, data access, and deployment assumptions before creating the mobile project
- Required checks:
  - confirm production domain: `https://maf-psi.vercel.app`
  - confirm Supabase URL and anon key are available as safe public config
  - confirm service-role key is server-only and never exposed to the APK
  - inspect current auth flow and session handling
  - inspect current Work Inbox data source: `src/actions/work-inbox.ts`
  - inspect Work Inbox item contract: `src/lib/work-inbox-types.ts`
  - identify which existing actions can be reused and which need mobile endpoints
  - decide whether push notifications will use Expo Push Service first or direct FCM later
  - confirm Expo/EAS account ownership and build permissions
  - decide offline cache library and stale-data behavior
  - decide mobile app version/update strategy
  - decide whether barcode scanning is in V1 or only a backlog capability
- Deliverables:
  - short discovery note inside this file or a new `PLAN/mobile-app-discovery.md`
  - final confirmation of mobile folder path
  - final confirmation of mobile framework
- Stop conditions:
  - unclear production API/data boundary
  - unclear auth token validation approach
  - any need to expose service-role credentials to the APK

## 7. Phase MOB-01 - Mobile Project Scaffold ✅ DONE

- Phase ID: `MOB-01`
- Title: Mobile Project Scaffold
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Goal:
  - create the separate mobile app without disturbing the current web app
- Recommended write scope:
  - `apps/mobile/**` or `mobile-app/**`
  - root package/workspace files only if required
- Recommended stack:
  - React Native
  - Expo
  - TypeScript
  - Expo Router or React Navigation
  - TanStack Query or equivalent cache-aware fetch layer
  - secure token storage
  - Supabase React Native client configuration
  - camera/image picker package
  - location package
  - `expo-notifications` for push token registration
  - `expo-updates` if OTA updates are approved
  - file upload support
- Required config:
  - app name
  - Android package ID
  - live API base URL
  - Supabase public URL
  - Supabase anon key
  - `app.json` / `app.config.ts`
  - `eas.json`
  - preview APK build profile
  - runtime/update channel strategy if using EAS Update
- Push scaffold:
  - request notification permission after login or at the first useful moment
  - obtain the Expo push token on supported devices
  - store token locally until the server registration endpoint exists
  - do not send production notifications until server-side targeting rules are reviewed
- Guardrails:
  - no changes to current desktop routes
  - no service-role secrets in mobile config
  - no dependency on localhost for release APK

## 8. Phase MOB-02 - Mobile Authentication ✅ DONE

- Phase ID: `MOB-02`
- Title: Mobile Authentication
- Difficulty: `L4`
- Recommended Agent: `Antigravity` with review
- Goal:
  - let mobile users sign in with the same Supabase users as the web app
- Requirements:
  - email/password login using Supabase Auth
  - configure Supabase for React Native, not browser cookies
  - use a React Native storage adapter such as `@react-native-async-storage/async-storage`
  - include `react-native-url-polyfill` if required by the Supabase client setup
  - set mobile auth options explicitly, including `autoRefreshToken`, `persistSession`, and `detectSessionInUrl: false`
  - include Supabase `processLock` or the current recommended lock mechanism if required by the latest React Native auth docs
  - use React Native `AppState` to start/stop Supabase token refresh when the app enters/leaves the foreground
  - secure storage for access and refresh tokens
  - automatic session restore after app restart
  - logout
  - expired-session handling
  - inactive-user handling using the existing `users.is_active` profile rule
- Required screens:
  - login
  - loading/restoring session
  - auth error state
  - logout confirmation
- API/security note:
  - if mobile calls `/api/mobile/...`, each request must send `Authorization: Bearer <supabase_access_token>`
  - server endpoints must validate the token with Supabase before trusting the user
- Success criteria:
  - same user can log in on web and mobile
  - mobile respects inactive/unauthorized users
  - closing and reopening the app keeps the session if valid

## 9. Phase MOB-03 - Mobile API Boundary ✅ DONE

- Phase ID: `MOB-03`
- Title: Mobile API Boundary
- Difficulty: `L3`
- Recommended Agent: `Antigravity` with review
- Goal:
  - create stable API endpoints for the mobile app instead of depending on desktop web internals
- Recommended endpoint namespace:
  - `/api/mobile/session`
  - `/api/mobile/critical-actions`
  - `/api/mobile/critical-actions/[id]`
  - `/api/mobile/push-tokens`
  - `/api/mobile/version`
  - `/api/mobile/uploads/sign` if signed upload flows are needed
  - `/api/mobile/audit/mobile-event` if GPS/camera actions need audit traces
- First endpoint:
  - `GET /api/mobile/critical-actions`
- Endpoint behavior:
  - validate Supabase bearer token
  - load the current user profile
  - apply the same permission/scope rules as the web app
  - return mobile-friendly DTOs
  - include response metadata where useful, such as `serverTime`, `apiVersion`, and `generatedAt`
  - never return service secrets
- Offline/cache contract:
  - Critical Actions V1 should cache the last successful response locally
  - cached data must be displayed as stale when offline or refresh fails
  - all cached payloads should include a visible `lastSyncedAt` value
  - V1 should not support offline approval/write actions
- Version contract:
  - `/api/mobile/version` should return current API version, minimum supported app version, latest APK version, and update message
  - app should block only when the installed APK is below the minimum supported version
- Push token contract:
  - `/api/mobile/push-tokens` should upsert the authenticated user's Expo push token
  - token records should include platform, app version, build number, last seen timestamp, and active/revoked state
- Reuse target:
  - reuse logic from `src/actions/work-inbox.ts` where safe
  - keep the shared item contract aligned with `src/lib/work-inbox-types.ts`
- Success criteria:
  - APK can fetch Critical Actions from the live deployed URL
  - results match the web page for the same user
  - unauthorized requests return a clean 401/403

## 10. Phase MOB-04 - Critical Actions Mobile V1 ✅ DONE

- Phase ID: `MOB-04`
- Title: Critical Actions Mobile V1
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Goal:
  - build the first useful mobile experience around Critical Actions
- Required screens:
  - Critical Actions home
  - priority tabs or filters
  - item list grouped by urgency/type
  - item detail
  - refresh state
  - empty state
  - offline/error state
- Offline behavior:
  - use a cache-aware fetch layer such as TanStack Query with a persistent cache
  - AsyncStorage is acceptable for simple V1 cache persistence; MMKV is acceptable if Antigravity decides the app needs faster local reads
  - show stale cached Critical Actions when the network request fails
  - show `last synced` time clearly
  - disable quick actions while offline unless an explicit queued-write design is approved
- Mobile content should show:
  - title
  - type
  - project
  - amount if available
  - age/priority
  - required action
  - source document reference
- V1 behavior:
  - read and navigate first
  - quick actions only where the current approval rule is already clear
  - avoid inventing new approval semantics
- Success criteria:
  - user can open mobile app and immediately see pending work
  - counts match the current `/company/critical-actions` page
  - mobile UI is touch-friendly and independent from the desktop layout

## 11. Phase MOB-05 - Mobile Item Details and Quick Actions ✅ DONE

- Phase ID: `MOB-05`
- Title: Mobile Item Details and Quick Actions
- Difficulty: `L3`
- Recommended Agent: `Antigravity` with review
- Goal:
  - allow mobile users to act on selected pending items without breaking workflow rules
- Start with safest actions:
  - review details
  - add note/comment
  - upload attachment/photo
  - mark reviewed if an existing workflow supports it
- Approval actions:
  - only add approve/reject when the existing module already has a clear server-side action
  - require confirmation before approving/rejecting
  - require rejection reason where current workflow requires it
  - log the action
- Guardrails:
  - no client-only approval logic
  - no status changes directly from mobile unless server endpoint enforces the rule
  - no bypass of permission checks
- Success criteria:
  - every mobile quick action produces the same result as the equivalent web action
  - failed actions show clear mobile errors
  - audit trail remains correct

## 12. Phase MOB-06 - Camera, Uploads, and Files ✅ DONE

- Phase ID: `MOB-06`
- Title: Camera, Uploads, and Files
- Difficulty: `L3`
- Recommended Agent: `Antigravity` with review
- Goal:
  - support mobile photo/file capture for operational records
- Required capabilities:
  - camera permission request
  - capture photo
  - pick file/image from device
  - upload to the correct Supabase Storage bucket or signed upload endpoint
  - attach uploaded file to the correct business record
  - show upload progress and failure state
- Barcode/scanning note:
  - if warehouse scanning enters V1, prefer Expo Camera's built-in barcode scanning APIs
  - do not use deprecated `expo-barcode-scanner`
  - define supported barcode types before implementation, such as QR, EAN-13, Code 128, or internal item labels
- Existing storage references:
  - `petty_expenses`
  - `maf-documents`
  - `items`
  - procurement attachment migrations
- Security requirements:
  - validate file type and size
  - preserve record ownership/scope checks
  - avoid permanent public links for sensitive files where possible
- Success criteria:
  - user can capture and upload a receipt/photo from Android
  - uploaded file appears in the web app where expected
  - failed upload does not create broken business records

## 13. Phase MOB-07 - GPS and Location Capture ✅ DONE

- Phase ID: `MOB-07`
- Title: GPS and Location Capture
- Difficulty: `L3`
- Recommended Agent: `Antigravity` with backend review
- Goal:
  - add GPS capture for mobile-only workflows
- Execution note:
  - this phase may be executed together with `MOB-06` because both use device permissions
  - it remains a separate phase in this plan because GPS has privacy, audit, and schema implications beyond camera/file upload
- Required decisions before implementation:
  - which actions require GPS
  - whether GPS is mandatory or optional
  - whether GPS should be stored on the business record or in a separate audit/event table
  - accuracy threshold
  - privacy rules
- Recommended approach:
  - create a dedicated mobile event/audit table if GPS applies to many modules
  - store latitude, longitude, accuracy, timestamp, user ID, device context, and linked record ID
  - never silently track background location in V1
- Success criteria:
  - GPS is captured only after explicit user action/permission
  - location is linked to the correct mobile action
  - users get a clear fallback if permission is denied

## 14. Phase MOB-08 - APK Build and Manual Install ✅ DONE

- Phase ID: `MOB-08`
- Title: APK Build and Manual Install
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Goal:
  - produce an Android APK that can be manually installed
- Requirements:
  - Android package ID
  - app name
  - app icon
  - production/live API URL
  - production Supabase public config
  - EAS CLI installed and authenticated
  - Expo/EAS project configured
  - `eas.json` committed with a preview APK profile
  - release build profile
  - signed APK when ready for real distribution
- EAS Build requirement:
  - use EAS Build, not classic `expo build:android`
  - preview/manual install builds should use an Android APK profile
  - expected command shape: `eas build -p android --profile preview`
  - `preview` should set Android `buildType` to `apk` or otherwise produce an installable APK
  - production Play Store builds may use AAB later, but manual installation needs APK
- Manual install docs:
  - how to transfer APK to Android device
  - how to allow installation from unknown sources
  - how to install/update
  - how to uninstall/rollback
- Success criteria:
  - APK installs on a real Android device
  - login works against live production
  - Critical Actions data loads from the live system
  - camera/upload/GPS features work on device after permission approval

## 15. Phase MOB-09 - Testing and Release Checklist

- Phase ID: `MOB-09`
- Title: Testing and Release Checklist
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Goal:
  - verify the APK without risking the current web app
- Required tests:
  - web app still builds and works
  - mobile app builds
  - APK installs
  - login success
  - login failure
  - logout
  - expired session
  - Critical Actions count matches web
  - item detail opens
  - quick action permission denied case
  - upload success/failure
  - GPS allowed/denied
  - notification permission allowed/denied
  - push token registration success/failure
  - cached Critical Actions appear when offline
  - stale cache displays `last synced`
  - version check allows supported versions
  - version check blocks unsupported versions
  - bad internet state
  - server 401/403/500 states
- Release checklist:
  - production URL confirmed
  - no localhost URL in release build
  - no service-role key in APK
  - no secret logs
  - app version recorded
  - Android `versionCode` recorded
  - update channel/runtime version recorded if using EAS Update
  - APK file name includes version/date
  - install/update notes written

## 16. Phase MOB-10 - Versioning, Updates, and Compatibility

- Phase ID: `MOB-10`
- Title: Versioning, Updates, and Compatibility
- Difficulty: `L3`
- Recommended Agent: `Antigravity` with review
- Design note:
  - the versioning and update strategy must be **decided in MOB-00** and **scaffolded in MOB-01** alongside `eas.json` and `app.config.ts`
  - this phase executes late in the release path, but the decisions it depends on cannot be deferred — an APK built without a version strategy cannot be safely updated or blocked later
  - specifically: `versionCode`, `runtimeVersion`, EAS Update channels, and the minimum-version enforcement logic must all be resolved before producing the first APK
- Goal:
  - prevent manually installed APKs from drifting away from the live API contract
- Required strategy:
  - define user-facing app version
  - define Android build number / `versionCode`
  - define mobile API version
  - define minimum supported app version
  - define latest available APK version
- Required endpoint:
  - `GET /api/mobile/version`
- App behavior:
  - check version on startup and after login
  - warn when a newer APK is available
  - block only when the installed version is below the minimum supported version
  - show a clear download/update instruction for manual APK users
- OTA update option:
  - EAS Update may be used for JavaScript, styling, copy, and asset changes that do not require native changes
  - native dependency changes, permission changes, Android package changes, and Expo SDK upgrades require a new APK build
  - if EAS Update is used, configure `runtimeVersion` and channels so incompatible updates are not sent to older builds
- Success criteria:
  - users are warned before their APK becomes incompatible
  - API DTO changes can be rolled out without silently breaking old APKs
  - Antigravity documents when a change needs OTA update versus a new APK

## 17. Mobile-Only Feature Backlog

Potential mobile-only features:

- camera receipt capture
- site photo upload
- GPS-stamped approval/review
- fast Critical Actions approval queue
- quick expense entry
- warehouse scan/capture flow, including barcode/QR scanning if approved
- field material issue confirmation
- site attendance/check-in if approved later
- server-driven push notification sending rules for real-time Critical Actions alerts

Each mobile-only feature must define:

- user role
- screen flow
- required permissions
- API endpoint
- database impact
- storage impact
- audit impact
- failure/rollback behavior

## 18. Non-Negotiable Rules

- Do not modify the desktop web UI as part of mobile scaffolding.
- Do not expose service-role secrets in the APK.
- Do not connect the APK directly to Postgres.
- Do not rely on localhost for APK release.
- Do not duplicate approval logic in the mobile client.
- Do not create new business statuses without review.
- Do not bypass current permissions, RLS, or audit rules.
- Do not make uploads public unless the record type is already safe for public links.
- Do not add GPS background tracking in V1.
- Do not ship a manual APK without a version/update strategy.
- Do not ship Critical Actions mobile V1 without at least local stale-read caching.
- Do not use classic Expo build commands for APK release.

## 19. Recommended First Antigravity Ticket

### Ticket AG-MOB-00

- Goal:
  - perform discovery and confirm the mobile integration boundary
- Write scope:
  - planning docs only
- Must inspect:
  - `src/lib/supabase.ts`
  - `src/lib/supabase-server.ts`
  - `src/lib/supabase-admin.ts`
  - `src/lib/auth.ts`
  - `src/middleware.ts`
  - `src/actions/work-inbox.ts`
  - `src/lib/work-inbox-types.ts`
  - `src/app/(system)/company/critical-actions/page.tsx`
  - `src/app/(system)/company/critical-actions/CriticalActionsClient.tsx`
- Must answer:
  - final mobile folder path
  - final mobile stack
  - whether first mobile API endpoints will live in the current Next app
  - how mobile API endpoints validate Supabase bearer tokens
  - whether Critical Actions V1 is read-only or includes quick actions
  - whether push notification token registration is scaffolded in MOB-01
  - what offline cache library/policy will be used
  - what EAS account/build profile will produce the manual APK
  - what version/update strategy will protect manual APK users

## 20. Final Recommendation

Start with a separate React Native/Expo mobile app and make Critical Actions the first real screen.

The safest first release path is:

1. mobile login
2. mobile API boundary
3. push token registration scaffold
4. offline stale-read cache
5. Critical Actions read-only mobile dashboard
6. item details
7. uploads/camera
8. GPS capture
9. quick actions
10. version/update strategy
11. APK release through EAS Build

This creates a useful Android app quickly while keeping the current web app stable and the shared database protected.
