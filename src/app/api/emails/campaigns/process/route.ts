import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Polls for campaigns with status='sending' (set by pg_cron) and triggers actual send.
// Can also be called by Vercel cron or manually.
// Protected by a secret token to prevent unauthorized triggering.
export async function POST(request: NextRequest) {
  const { secret } = await request.json().catch(() => ({}));
  const expectedSecret = process.env.CRON_SECRET || process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);

  // Find campaigns that pg_cron has moved to 'sending'
  const { data: campaigns } = await supabase
    .from("email_campaigns")
    .select("id, user_id")
    .eq("status", "sending")
    .is("completed_at", null);

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;

  for (const campaign of campaigns) {
    try {
      // Trigger the send endpoint internally
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
      const res = await fetch(`${baseUrl}/api/emails/campaigns/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward auth as service — the send route needs user auth,
          // so we create a temporary session for the campaign owner
          "x-campaign-process": expectedSecret || "",
        },
        body: JSON.stringify({ campaignId: campaign.id }),
      });

      if (res.ok) {
        processed++;
      } else {
        // Mark as failed if send route rejects
        await supabase
          .from("email_campaigns")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", campaign.id);
      }
    } catch {
      await supabase
        .from("email_campaigns")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", campaign.id);
    }
  }

  return NextResponse.json({ ok: true, processed, total: campaigns.length });
}
