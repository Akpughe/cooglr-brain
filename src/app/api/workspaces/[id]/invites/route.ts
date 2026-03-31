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

    // Send invite email via Resend
    let emailSent = false;
    try {
      const { Resend } = await import("resend");
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const resend = new Resend(resendKey);
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
        const inviterName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Someone";
        const wsName = workspace?.name || "a workspace";

        const { error: sendError } = await resend.emails.send({
          from: "Nuton <noreply@nuton.app>",
          to: normalizedEmail,
          subject: `${inviterName} invited you to ${wsName}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="padding:32px 32px 0;">
          <div style="width:40px;height:40px;background:#1a1a1a;border-radius:10px;color:#fff;font-weight:800;font-size:14px;line-height:40px;text-align:center;">5C</div>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:24px 32px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111;">You've been invited</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.5;">
            <strong>${inviterName}</strong> invited you to join <strong>${wsName}</strong> on Nuton.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;padding:12px 28px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">
            Accept Invite
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#999;line-height:1.5;">
            This invite expires in 7 days. If you don't have an account yet, you'll be asked to sign in with Google first.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:11px;color:#bbb;">
            Nuton — Your all-in-one workspace for teams
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
          `,
        });

        if (sendError) {
          console.error(`[invite] Failed to send email to ${normalizedEmail}:`, sendError);
        } else {
          emailSent = true;
        }
      } else {
        console.warn("[invite] RESEND_API_KEY not set, skipping email");
      }
    } catch (err) {
      console.error(`[invite] Email send error for ${normalizedEmail}:`, err);
    }

    results.push({ email: normalizedEmail, status: "invited", emailSent });
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
