import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

// One-click unsubscribe with signed token
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse("Invalid unsubscribe link", { status: 400 });
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    return new NextResponse("Invalid or expired unsubscribe link", { status: 400 });
  }

  const { userId, email, campaignId } = verified;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new NextResponse("Server error", { status: 500 });
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);

  // Mark contact as unsubscribed (scoped to the correct user)
  await supabase
    .from("email_contacts")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("email", email.toLowerCase());

  // Add to global suppression list
  await supabase.from("email_unsubscribes").upsert(
    {
      user_id: userId,
      email: email.toLowerCase(),
      reason: "link_click",
      campaign_id: campaignId || null,
    },
    { onConflict: "user_id,email" }
  );

  // Log event
  if (campaignId) {
    const { data: contact } = await supabase
      .from("email_contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("email", email.toLowerCase())
      .single();

    if (contact) {
      await supabase.from("email_events").insert({
        campaign_id: campaignId,
        contact_id: contact.id,
        user_id: userId,
        event_type: "unsubscribed",
        metadata: { source: "one_click_link" },
      });
    }
  }

  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf8f5;color:#292524}
.card{text-align:center;padding:48px;max-width:400px}h1{font-size:20px;margin-bottom:8px}p{color:#78716c;font-size:14px}</style></head>
<body><div class="card"><h1>You've been unsubscribed</h1><p>You will no longer receive marketing emails from this sender.</p></div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// POST handler for List-Unsubscribe-Post (RFC 8058)
export async function POST(request: NextRequest) {
  return GET(request);
}
