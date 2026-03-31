import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { WorkspaceProvider } from "@/lib/workspace/context";
import { ShellThemeProvider } from "@/components/shell/theme-provider";
import { IconRail } from "@/components/shell/icon-rail";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppRouteGuard } from "@/components/shell/app-route-guard";
import { formatMember } from "@/lib/workspace/helpers";
import { PresenceProvider } from "@/lib/messages/presence-context";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) notFound();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/");
  }

  const { data: appsData } = await supabase
    .from("workspace_apps")
    .select(`
      app_id,
      app_registry:app_id (id, name, icon, route, has_sidebar, category, sort_order)
    `)
    .eq("workspace_id", workspace.id);

  const installedApps = (appsData || [])
    .map((a) => a.app_registry as any)
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      route: a.route,
      hasSidebar: a.has_sidebar,
      category: a.category,
    }));

  const { data: membersData } = await supabase
    .from("workspace_members")
    .select(`
      id, user_id, role, joined_at,
      profiles:user_id (full_name, email, avatar_url)
    `)
    .eq("workspace_id", workspace.id);

  const members = (membersData || []).map(formatMember);

  const contextValue = {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      avatarUrl: workspace.avatar_url,
      ownerId: workspace.owner_id,
      theme: workspace.theme || "default",
      createdAt: workspace.created_at,
    },
    membership: { role: membership.role as "owner" | "member" },
    installedApps,
    members,
    currentUserId: user.id,
  };

  return (
    <WorkspaceProvider value={contextValue}>
      <PresenceProvider>
        <ShellThemeProvider themeId={workspace.theme || "default"}>
          <div className="flex h-screen bg-background">
            <IconRail />
            <AppSidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
              <AppRouteGuard>{children}</AppRouteGuard>
            </main>
          </div>
        </ShellThemeProvider>
      </PresenceProvider>
    </WorkspaceProvider>
  );
}
