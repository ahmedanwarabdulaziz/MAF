import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompany } from "@/lib/projects";
import { createClient } from "@/lib/supabase-server";
import { getEffectiveModuleKeys, getUserScopes } from "@/lib/permissions";
import { perfMark, perfEnd, perfWrap } from "@/lib/perf";
import { getSystemUser } from "@/lib/system-context";
import SidebarNav from "./SidebarNav";
import HeaderNav from "./HeaderNav";
import SettingsMenu from "./SettingsMenu";
import PurchaseRequestDialog from "@/components/procurement/PurchaseRequestDialog";
import SupplierInvoiceDialog from "@/components/procurement/SupplierInvoiceDialog";
import GlobalSearchBar from "@/components/layout/GlobalSearchBar";
import { QueryProvider } from "@/providers/query-provider";
import TopbarInboxButton from "@/components/work-inbox/TopbarInboxButton";
import { getWorkInboxCount } from "@/actions/work-inbox";

async function getActiveProjects() {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, arabic_name, project_code")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export default async function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tLayout = perfMark('layout:total')

  // PERF-02: getSystemUser is now cached via React cache() in system-context.ts.
  // If any server action in this request already called getSystemUser(),
  // this returns the cached result with zero extra DB round-trips.
  const user = await perfWrap('layout:getSystemUser', getSystemUser);

  if (!user) {
    redirect("/login");
  }

  // PERF-02: load inbox count server-side in the same parallel batch.
  // TopbarInboxButton receives it as initialCount — zero client fetches on mount.
  const tParallel = perfMark('layout:parallel-fetch')
  const [projects, allowedModules, userScopes, company, inboxCount] = await Promise.all([
    getActiveProjects(),
    getEffectiveModuleKeys(user.id, { includeAllScopes: true }),
    getUserScopes(user.id),
    getCompany(),
    getWorkInboxCount().catch(() => 0),
  ]);
  perfEnd(tParallel)
  perfEnd(tLayout)

  // Convert Set to Array for serialisation into Client Components
  const allowedModulesArray = Array.from(allowedModules);
  const isSuperAdmin = user?.is_super_admin ?? false;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-72 h-screen sticky top-0 flex-col border-l border-navy/20 bg-navy text-white shadow-xl flex shrink-0">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-white/10 px-6">
          <Link href="/company" className="text-xl font-bold tracking-tight">
            نظام الإدارة
          </Link>
        </div>

        <div className="flex-1 overflow-hidden px-3 py-3">
          <SidebarNav
            isSuperAdmin={isSuperAdmin}
            allowedModules={allowedModulesArray}
            companyName={company?.arabic_name}
          />
        </div>

        {/* Settings gear — Super Admin only, sits above user footer */}
        {isSuperAdmin && <SettingsMenu />}

        {/* User profile footer */}
        <div className="border-t border-white/10 px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/30 flex items-center justify-center text-sm font-bold text-white">
            {user?.display_name?.[0] ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-medium text-white">
              {user?.display_name ?? "مستخدم"}
            </div>
            {isSuperAdmin && (
              <div className="text-xs text-white/50">مدير النظام</div>
            )}
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6 shadow-sm">
          {/* Project / Company navigation tags */}
          <div className="flex-1 overflow-x-auto">
            <HeaderNav
              projects={projects}
              userScopes={userScopes}
              isSuperAdmin={isSuperAdmin}
              companyName={company?.arabic_name}
            />
          </div>

          <div className="flex items-center gap-6 shrink-0 mr-4 relative w-full justify-end sm:w-auto">
            <GlobalSearchBar />
            {/* PERF-02: initialCount served from layout — no client fetch */}
            <TopbarInboxButton initialCount={inboxCount} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background-secondary p-8">
          <QueryProvider>
            <React.Suspense fallback={null}>
              <PurchaseRequestDialog />
              <SupplierInvoiceDialog />
            </React.Suspense>
            {children}
          </QueryProvider>
        </main>
      </div>
    </div>
  );
}

// ─── Logout button ────────────────────────────────────────────────
function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="text-white/50 hover:text-white focus:outline-none focus-visible:text-white focus-visible:underline focus-visible:ring-2 focus-visible:ring-white/50 rounded px-1 transition-colors text-xs"
        title="تسجيل الخروج"
      >
        خروج
      </button>
    </form>
  );
}
