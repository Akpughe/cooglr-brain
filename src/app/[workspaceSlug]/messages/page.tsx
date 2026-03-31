import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces").select("id").eq("slug", workspaceSlug).single();

  if (!workspace) redirect(`/${workspaceSlug}`);

  const { data: general } = await supabase
    .from("channels").select("id").eq("workspace_id", workspace.id).eq("is_default", true).single();

  if (general) redirect(`/${workspaceSlug}/messages/c/${general.id}`);

  const { data: firstChannel } = await supabase
    .from("channels").select("id").eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true }).limit(1).single();

  if (firstChannel) redirect(`/${workspaceSlug}/messages/c/${firstChannel.id}`);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">No channels yet</h1>
        <p className="text-muted-foreground text-sm">Create a channel to start messaging.</p>
      </div>
    </div>
  );
}
