import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

// Verify Resend webhook signature (svix-based)
function verifyWebhookSignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret configured (dev mode)

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Check timestamp is within 5 minutes
  const ts = parseInt(svixTimestamp);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Compute expected signature
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes).update(toSign).digest("base64");

  // Check against provided signatures (comma-separated, versioned)
  const signatures = svixSignature.split(" ").map((s) => s.replace(/^v\d+,/, ""));
  return signatures.some((sig) => sig === expected);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify webhook signature
  if (!verifyWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const { type, data } = body;
  if (!type || !data) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const eventMap: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
  };

  const eventType = eventMap[type];
  if (!eventType) return NextResponse.json({ ok: true });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);

  const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to;
  const resendEmailId = data.email_id;

  // Extract campaign ID from Resend tags (set during send)
  const campaignTag = (data.tags as { name: string; value: string }[] | undefined)
    ?.find((t) => t.name === "campaign_id");
  const campaignId = campaignTag?.value || null;

  const metadata: Record<string, unknown> = {
    resend_email_id: resendEmailId,
    recipient: recipientEmail,
  };
  if (eventType === "clicked" && data.click?.link) metadata.click_url = data.click.link;
  if (eventType === "bounced") {
    metadata.bounce_type = data.bounce?.type;
    metadata.bounce_message = data.bounce?.message;
  }

  // Find contact by email — scope to campaign owner if possible
  let contact: { id: string; user_id: string } | null = null;

  if (campaignId) {
    // Get user_id from campaign, then find contact scoped to that user
    const { data: camp } = await supabase
      .from("email_campaigns")
      .select("user_id")
      .eq("id", campaignId)
      .single();

    if (camp) {
      const { data: contacts } = await supabase
        .from("email_contacts")
        .select("id, user_id")
        .eq("email", recipientEmail)
        .eq("user_id", camp.user_id)
        .limit(1);
      contact = contacts?.[0] || null;
    }
  }

  if (!contact) {
    // Fallback: find any contact with this email
    const { data: contacts } = await supabase
      .from("email_contacts")
      .select("id, user_id")
      .eq("email", recipientEmail)
      .limit(1);
    contact = contacts?.[0] || null;
  }

  const userId = contact?.user_id;
  if (!userId) return NextResponse.json({ ok: true, matched: false });

  // Insert event (dedupe)
  const providerEventId = `${resendEmailId}-${eventType}-${Date.now()}`;
  await supabase
    .from("email_events")
    .upsert(
      {
        campaign_id: campaignId,
        contact_id: contact?.id || null,
        user_id: userId,
        event_type: eventType,
        provider_event_id: providerEventId,
        metadata,
      },
      { onConflict: "provider_event_id" }
    );

  // Atomic campaign stat increment
  if (campaignId) {
    await supabase.rpc("increment_campaign_stat", {
      p_campaign_id: campaignId,
      p_stat_key: eventType,
    });
  }

  // Update contact engagement
  if (contact?.id) {
    if (eventType === "opened") {
      await supabase.rpc("increment_contact_opened", { p_contact_id: contact.id });
    }
    if (eventType === "clicked") {
      await supabase.rpc("increment_contact_clicked", { p_contact_id: contact.id });
    }
    if (eventType === "delivered") {
      await supabase.from("email_contacts").update({ last_emailed_at: new Date().toISOString() }).eq("id", contact.id);
    }
    if (eventType === "bounced") {
      await supabase.from("email_contacts").update({ status: "bounced", bounced_at: new Date().toISOString() }).eq("id", contact.id);
      await supabase.from("email_unsubscribes").upsert(
        { user_id: userId, email: recipientEmail, reason: "bounce", campaign_id: campaignId },
        { onConflict: "user_id,email" }
      );
    }
    if (eventType === "complained") {
      await supabase.from("email_contacts").update({ status: "complained" }).eq("id", contact.id);
      await supabase.from("email_unsubscribes").upsert(
        { user_id: userId, email: recipientEmail, reason: "complaint", campaign_id: campaignId },
        { onConflict: "user_id,email" }
      );
    }
  }

  return NextResponse.json({ ok: true, matched: true });
}
