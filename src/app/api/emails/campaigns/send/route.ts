import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId, workspaceId } = await request.json();
  if (!campaignId) return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });

  console.log("[send] Starting campaign send:", campaignId);

  // Load campaign with relations
  const campaignQuery = supabase
    .from("email_campaigns")
    .select("*, provider:email_providers(*), audience:email_audiences(id, name)")
    .eq("id", campaignId);

  if (workspaceId) {
    campaignQuery.eq("workspace_id", workspaceId);
  } else {
    campaignQuery.eq("user_id", user.id);
  }

  const { data: campaign, error: loadErr } = await campaignQuery.single();

  if (!campaign) {
    console.log("[send] Campaign not found:", loadErr?.message);
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  console.log("[send] Campaign loaded:", {
    name: campaign.name,
    status: campaign.status,
    is_test: campaign.is_test,
    has_html: !!campaign.html_content,
    html_length: campaign.html_content?.length || 0,
    from_email: campaign.from_email,
    from_name: campaign.from_name,
    provider: campaign.provider?.name,
    audience_id: campaign.audience_id,
    test_recipients: campaign.test_recipients,
  });

  if (campaign.status === "sending") {
    console.log("[send] Campaign currently sending, aborting");
    return NextResponse.json({ error: "Campaign is currently sending" }, { status: 400 });
  }
  // Allow re-sending test campaigns and failed campaigns
  if (campaign.status === "sent" && !campaign.is_test) {
    console.log("[send] Live campaign already sent, aborting");
    return NextResponse.json({ error: "Campaign has already been sent" }, { status: 400 });
  }
  if (!campaign.html_content) {
    console.log("[send] Campaign has no HTML content, aborting");
    return NextResponse.json({ error: "Campaign has no email content" }, { status: 400 });
  }

  // Resolve provider — use campaign's linked provider, or fall back to user's default
  let provider = campaign.provider;
  if (!provider) {
    console.log("[send] Campaign provider missing, falling back to default provider");
    const providerQuery = supabase
      .from("email_providers")
      .select("*")
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .limit(1);

    if (workspaceId) {
      providerQuery.eq("workspace_id", workspaceId);
    } else {
      providerQuery.eq("user_id", user.id);
    }

    const { data: defaultProvider } = await providerQuery.single();

    provider = defaultProvider;

    if (provider) {
      // Always use the current provider's from address
      campaign.from_email = provider.from_email;
      campaign.from_name = provider.from_name;

      await supabase
        .from("email_campaigns")
        .update({
          provider_id: provider.id,
          from_email: provider.from_email,
          from_name: provider.from_name,
        })
        .eq("id", campaignId);
    }
  }

  if (!provider) {
    console.log("[send] No email provider found for user, aborting");
    return NextResponse.json({ error: "No email provider configured. Add one in Settings." }, { status: 400 });
  }

  // Always sync from address with provider's current settings
  if (campaign.from_email !== provider.from_email || campaign.from_name !== provider.from_name) {
    console.log("[send] Syncing from address:", { old: campaign.from_email, new: provider.from_email });
    campaign.from_email = provider.from_email;
    campaign.from_name = provider.from_name;
    await supabase
      .from("email_campaigns")
      .update({ from_email: provider.from_email, from_name: provider.from_name })
      .eq("id", campaignId);
  }

  console.log("[send] Using provider:", { id: provider.id, name: provider.name, from: provider.from_email });

  // Decrypt API key
  let apiKey: string;
  try {
    apiKey = decrypt(provider.encrypted_api_key);
    console.log("[send] API key decrypted, length:", apiKey.length);
  } catch (err) {
    console.error("[send] Failed to decrypt API key:", err);
    return NextResponse.json({ error: "Failed to decrypt provider API key" }, { status: 500 });
  }

  // Determine recipients
  let recipients: { email: string; first_name?: string; last_name?: string }[] = [];

  if (campaign.is_test && campaign.test_recipients?.length > 0) {
    recipients = campaign.test_recipients.map((e: string) => ({ email: e }));
    console.log("[send] Test mode — recipients:", campaign.test_recipients);
  } else if (campaign.audience_id) {
    const { data: links, error: linkErr } = await supabase
      .from("email_audience_contacts")
      .select("contact:email_contacts(id, email, first_name, last_name, status)")
      .eq("audience_id", campaign.audience_id);

    console.log("[send] Audience query:", { audience_id: campaign.audience_id, links_count: links?.length, error: linkErr?.message });

    if (links) {
      recipients = links
        .map((l) => l.contact as unknown as { id: string; email: string; first_name: string; last_name: string; status: string })
        .filter((c) => c && c.status === "active");
    }
    console.log("[send] Active recipients from audience:", recipients.length);
  } else {
    console.log("[send] No audience and not test mode — no recipients");
  }

  if (recipients.length === 0) {
    console.log("[send] No recipients found, aborting");
    return NextResponse.json({ error: "No recipients found" }, { status: 400 });
  }

  // Check global suppression list
  const emails = recipients.map((r) => r.email);
  const suppressQuery = supabase
    .from("email_unsubscribes")
    .select("email")
    .in("email", emails);

  if (workspaceId) {
    suppressQuery.eq("workspace_id", workspaceId);
  } else {
    suppressQuery.eq("user_id", user.id);
  }

  const { data: suppressed } = await suppressQuery;

  const suppressedSet = new Set((suppressed || []).map((s) => s.email));
  const suppressedCount = recipients.filter((r) => suppressedSet.has(r.email)).length;
  recipients = recipients.filter((r) => !suppressedSet.has(r.email));

  console.log("[send] Suppression check:", { suppressed: suppressedCount, remaining: recipients.length });

  if (recipients.length === 0) {
    console.log("[send] All recipients suppressed, aborting");
    return NextResponse.json({ error: "All recipients are unsubscribed" }, { status: 400 });
  }

  // Update campaign status
  await supabase
    .from("email_campaigns")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("id", campaignId);

  // Send via Resend in batches of 50
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  let sentCount = 0;
  let errorCount = 0;
  const sendErrors: string[] = [];
  const batchSize = 50;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    console.log(`[send] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} recipients)`);

    const sends = batch.map((r) => {
      // Personalize HTML
      let html = campaign.html_content;
      html = html.replace(/\{\{first_name\}\}/g, r.first_name || "there");
      html = html.replace(/\{\{last_name\}\}/g, r.last_name || "");
      html = html.replace(/\{\{email\}\}/g, r.email);

      // Signed unsubscribe URL
      const unsubToken = signUnsubscribeToken(user.id, r.email, campaignId);
      const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/emails/unsubscribe?token=${unsubToken}`;
      html = html.replace(/\{\{unsubscribe_url\}\}/g, unsubUrl);

      const subject = campaign.is_test ? `[TEST] ${campaign.subject}` : campaign.subject;

      const fromStr = campaign.from_name
        ? `${campaign.from_name} <${campaign.from_email}>`
        : campaign.from_email;

      console.log("[send] Sending to:", r.email, "| from:", fromStr, "| subject:", subject, "| html bytes:", html.length);

      return resend.emails.send({
        from: fromStr,
        to: [r.email],
        subject,
        html,
        replyTo: campaign.reply_to || undefined,
        tags: [{ name: "campaign_id", value: campaignId }],
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    });

    const results = await Promise.allSettled(sends);
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const recipient = batch[j]?.email;

      if (result.status === "fulfilled" && result.value?.data?.id) {
        sentCount++;
        console.log("[send] OK:", recipient, "| resend_id:", result.value.data.id);
      } else {
        errorCount++;
        let errMsg = "Unknown error";
        if (result.status === "rejected") {
          errMsg = result.reason?.message || String(result.reason);
        } else if (result.status === "fulfilled" && result.value?.error) {
          errMsg = result.value.error.message || JSON.stringify(result.value.error);
        }
        sendErrors.push(errMsg);
        console.error("[send] FAILED:", recipient, "| error:", errMsg, "| full result:", JSON.stringify(result));
      }
    }
  }

  // Update campaign stats
  const stats = {
    total: recipients.length,
    sent: sentCount,
    delivered: 0, opened: 0, unique_opened: 0,
    clicked: 0, unique_clicked: 0,
    bounced: errorCount, complained: 0, unsubscribed: 0,
  };

  const finalStatus = sentCount === 0 ? "failed" : "sent";

  console.log("[send] Campaign complete:", { finalStatus, sentCount, errorCount, total: recipients.length, errors: sendErrors });

  await supabase
    .from("email_campaigns")
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      stats,
    })
    .eq("id", campaignId);

  // Log activity
  try {
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action: "sent",
      section: "emails",
      title: `Sent campaign: ${campaign.name}`,
      description: `${sentCount} emails sent to ${campaign.audience?.name || "recipients"}`,
    });
  } catch { /* activity log is optional */ }

  return NextResponse.json({
    ok: sentCount > 0,
    sent: sentCount,
    errors: errorCount,
    total: recipients.length,
    errorDetails: sendErrors.length > 0 ? sendErrors.slice(0, 5) : undefined,
  });
}
