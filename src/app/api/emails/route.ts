import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/google";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, subject, bodyHtml, recipients, id } = await request.json();

  if (action === "draft") {
    const { data, error } = await supabase
      .from("email_campaigns")
      .insert({
        user_id: user.id,
        subject: subject || "(no subject)",
        body_html: bodyHtml || "",
        recipients: recipients || [],
        status: "draft",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "send") {
    const token = await getUserToken(supabase, user.id, "google");
    if (!token) return NextResponse.json({ error: "Google not connected. Go to Settings to connect." }, { status: 400 });

    if (!recipients?.length || !subject) {
      return NextResponse.json({ error: "Recipients and subject required" }, { status: 400 });
    }

    let sentCount = 0;
    let lastMessageId = "";

    for (const to of recipients) {
      try {
        const result = await sendEmail(token, to, subject, bodyHtml || "");
        lastMessageId = result.id;
        sentCount++;
      } catch (err) {
        console.error(`[email] failed to send to ${to}:`, err);
      }
    }

    if (id) {
      await supabase
        .from("email_campaigns")
        .update({ status: sentCount > 0 ? "sent" : "failed", sent_count: sentCount, gmail_message_id: lastMessageId, sent_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("email_campaigns")
        .insert({
          user_id: user.id,
          subject,
          body_html: bodyHtml || "",
          recipients,
          status: sentCount > 0 ? "sent" : "failed",
          sent_count: sentCount,
          gmail_message_id: lastMessageId,
          sent_at: new Date().toISOString(),
        });
    }

    return NextResponse.json({ ok: true, sentCount });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
