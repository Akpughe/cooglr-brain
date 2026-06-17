import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AgentWorkspaceShell } from "@/components/agent-shell/agent-workspace-shell";
import type { ThreadSummary } from "@/components/agent-shell/types";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .single();
  if (!workspace) notFound();

  // Recent threads — best effort (degrades to empty if migration 024 isn't applied yet).
  let initialThreads: ThreadSummary[] = [];
  const { data: threads } = await supabase
    .from("agent_threads")
    .select("id, title, pinned, last_message_at")
    .eq("workspace_id", workspace.id)
    .eq("archived", false)
    .order("last_message_at", { ascending: false })
    .limit(40);
  if (threads) {
    initialThreads = threads.map((t) => ({
      id: t.id as string,
      title: (t.title as string) || "New chat",
      pinned: Boolean(t.pinned),
      lastMessageAt: (t.last_message_at as string) ?? null,
    }));
  }

  return (
    <AgentWorkspaceShell
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      currentUserId={user.id}
      initialThreads={initialThreads}
    />
  );
}
