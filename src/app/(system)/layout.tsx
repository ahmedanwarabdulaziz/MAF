import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SidebarNav from "./SidebarNav";
import HeaderNav from "./HeaderNav";
import SettingsMenu from "./SettingsMenu";

async function getSystemUser() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, display_name, is_super_admin")
    .eq("id", authUser.id)
    .single();

  return profile;
}

async function getActiveProjects() {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, arabic_name, project_code")
    .in("status", ["active", "in_progress", "ongoing"])
    .order("created_at", { ascending: true });
  return data ?? [];
}

export default async function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, projects] = await Promise.all([
    getSystemUser(),
    getActiveProjects(),
  ]);

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
          <SidebarNav isSuperAdmin={user?.is_super_admin || false} />
        </div>

        {/* Settings gear — Super Admin only, sits above user footer */}
        {user?.is_super_admin && <SettingsMenu />}

        {/* User profile footer */}
        <div className="border-t border-white/10 px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/30 flex items-center justify-center text-sm font-bold text-white">
            {user?.display_name?.[0] ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-medium text-white">
              {user?.display_name ?? "مستخدم"}
            </div>
            {user?.is_super_admin && (
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
            <HeaderNav projects={projects} />
          </div>

          <div className="flex items-center gap-6 shrink-0 mr-4">
            <div className="text-sm font-medium text-text-secondary cursor-pointer hover:text-primary">
              الإشعارات
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background-secondary p-8">
          {children}
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
        className="text-white/50 hover:text-white transition-colors text-xs"
        title="تسجيل الخروج"
      >
        خروج
      </button>
    </form>
  );
}
