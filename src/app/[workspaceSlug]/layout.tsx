import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { WorkspaceProvider } from "@/lib/workspace/context";
import { ShellThemeProvider } from "@/components/shell/theme-provider";
import { WorkspaceChrome } from "@/components/shell/workspace-chrome";
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

  // Use service client for members — the profiles:user_id FK join doesn't work
  // because workspace_members.user_id references auth.users, not profiles
  const svc = await createServiceClient();

  const { data: membersData } = await svc
    .from("workspace_members")
    .select("id, user_id, role, joined_at")
    .eq("workspace_id", workspace.id);

  // Resolve profiles for all member user IDs
  const memberUserIds = (membersData || []).map((m) => m.user_id);
  const { data: profilesData } = memberUserIds.length > 0
    ? await svc.from("profiles").select("id, full_name, email, avatar_url").in("id", memberUserIds)
    : { data: [] };

  const profilesMap = new Map(
    (profilesData || []).map((p) => [p.id, p])
  );

  const members = (membersData || []).map((m) => {
    const profile = profilesMap.get(m.user_id);
    return {
      id: m.id,
      userId: m.user_id,
      fullName: profile?.full_name || "",
      email: profile?.email || "",
      avatarUrl: profile?.avatar_url || null,
      role: m.role as "owner" | "member",
      joinedAt: m.joined_at,
    };
  });

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
          <WorkspaceChrome>{children}</WorkspaceChrome>
        </ShellThemeProvider>
      </PresenceProvider>
    </WorkspaceProvider>
  );
}
