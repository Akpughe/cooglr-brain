import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InviteAcceptClient } from "./invite-accept-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Use service client for invite lookup — publicly accessible page
  const serviceClient = await createServiceClient();

  // Verify token
  const { data: invite } = await serviceClient
    .from("workspace_invites")
    .select("*, workspaces(name, slug)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 animate-in fade-in duration-500">
          <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto text-muted-foreground text-xl">?</div>
          <h1 className="text-xl font-semibold">Invalid or Expired Invite</h1>
          <p className="text-muted-foreground text-sm">This invite link is no longer valid.</p>
          <a href="/login" className="inline-block text-sm text-primary hover:underline">Go to login</a>
        </div>
      </div>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    await serviceClient
      .from("workspace_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 animate-in fade-in duration-500">
          <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto text-muted-foreground text-xl">⏰</div>
          <h1 className="text-xl font-semibold">Invite Expired</h1>
          <p className="text-muted-foreground text-sm">Ask the workspace owner to send a new invite.</p>
        </div>
      </div>
    );
  }

  const workspaceName = (invite.workspaces as any)?.name || "a workspace";
  const workspaceSlug = (invite.workspaces as any)?.slug || "";
  const workspaceInitial = workspaceName[0]?.toUpperCase() || "W";

  // Check if user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Not authenticated — show invite landing page with Google sign-in
    return (
      <InviteAcceptClient
        token={token}
        workspaceName={workspaceName}
        workspaceInitial={workspaceInitial}
        inviteEmail={invite.email}
        authenticated={false}
      />
    );
  }

  // Authenticated — verify email matches
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm animate-in fade-in duration-500">
          <div className="w-14 h-14 bg-foreground rounded-2xl flex items-center justify-center mx-auto text-background text-xl font-bold">{workspaceInitial}</div>
          <h1 className="text-xl font-semibold">Wrong Account</h1>
          <p className="text-muted-foreground text-sm">
            This invite was sent to <strong>{invite.email}</strong>. You&apos;re signed in as <strong>{user.email}</strong>.
          </p>
          <p className="text-muted-foreground text-sm">Sign out and sign in with the correct Google account.</p>
        </div>
      </div>
    );
  }

  // Email matches — auto-accept the invite
  const workspaceId = invite.workspace_id;

  const { data: existingMembership } = await serviceClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!existingMembership) {
    await serviceClient.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: invite.role || "member",
    });
  }

  await serviceClient
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  redirect(`/${workspaceSlug}`);
}
