import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Verify token
  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("*, workspaces(name, slug)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Invalid or Expired Invite</h1>
          <p className="text-muted-foreground">This invite link is no longer valid.</p>
          <a href="/login" className="text-primary underline">Go to login</a>
        </div>
      </div>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from("workspace_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Invite Expired</h1>
          <p className="text-muted-foreground">Ask the workspace owner to send a new invite.</p>
        </div>
      </div>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/invite/${token}`);
  }

  // Verify the authenticated user's email matches the invite
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Wrong Account</h1>
          <p className="text-muted-foreground">
            This invite was sent to <strong>{invite.email}</strong>. Please sign in with that email.
          </p>
          <a href="/login" className="text-primary underline">Switch account</a>
        </div>
      </div>
    );
  }

  const workspaceId = invite.workspace_id;

  const { data: existingMembership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!existingMembership) {
    await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: invite.role || "member",
    });
  }

  await supabase
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  const slug = (invite.workspaces as any)?.slug;
  redirect(`/${slug || ""}`);
}
