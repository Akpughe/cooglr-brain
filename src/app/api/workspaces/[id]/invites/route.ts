import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

function generateInviteToken(): string {
  const raw = randomBytes(32).toString("hex");
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) throw new Error("CREDENTIAL_ENCRYPTION_KEY is required");
  const hmac = createHmac("sha256", key);
  return hmac.update(raw).digest("hex");
}

// GET /api/workspaces/[id]/invites
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invites: data });
}

// POST /api/workspaces/[id]/invites — create invites
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can invite members" }, { status: 403 });
  }

  const { emails } = await request.json();

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "At least one email required" }, { status: 400 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, slug")
    .eq("id", id)
    .single();

  const results = [];

  for (const email of emails) {
    const normalizedEmail = email.toLowerCase().trim();

    const { data: existingInvite } = await supabase
      .from("workspace_invites")
      .select("id")
      .eq("workspace_id", id)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      results.push({ email: normalizedEmail, status: "already_invited" });
      continue;
    }

    const token = generateInviteToken();

    const { error } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: id,
        email: normalizedEmail,
        invited_by: user.id,
        token,
      });

    if (error) {
      results.push({ email: normalizedEmail, status: "error", error: error.message });
      continue;
    }

    // Send invite email via Resend (best-effort)
    try {
      const { Resend } = await import("resend");
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const resend = new Resend(resendKey);
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
        await resend.emails.send({
          from: "500Claw <noreply@500chow.app>",
          to: normalizedEmail,
          subject: `You're invited to join ${workspace?.name} on 500Claw`,
          html: `
            <p>You've been invited to join <strong>${workspace?.name}</strong> on 500Claw.</p>
            <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;">Accept Invite</a></p>
            <p>This invite expires in 7 days.</p>
          `,
        });
      }
    } catch {
      // Email sending is best-effort
    }

    results.push({ email: normalizedEmail, status: "invited" });
  }

  return NextResponse.json({ results }, { status: 201 });
}

// PATCH /api/workspaces/[id]/invites — revoke invite
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can manage invites" }, { status: 403 });
  }

  const { inviteId, action } = await request.json();

  if (action === "revoke") {
    const { error } = await supabase
      .from("workspace_invites")
      .update({ status: "expired" })
      .eq("id", inviteId)
      .eq("workspace_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
