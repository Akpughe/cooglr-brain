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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <svg className="size-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold">No channels yet</h1>
        <p className="max-w-xs text-sm text-muted-foreground">Create a channel to start messaging.</p>
      </div>
    </div>
  );
}
