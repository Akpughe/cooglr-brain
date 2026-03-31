import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId, conversationId, lastReadAt } = await request.json();
  if (!channelId && !conversationId) {
    return NextResponse.json({ error: "channelId or conversationId required" }, { status: 400 });
  }

  const readAt = lastReadAt || new Date().toISOString();

  // Manual upsert — partial unique indexes don't work with Supabase's upsert onConflict
  if (channelId) {
    const { data: existing } = await supabase
      .from("message_reads")
      .select("id")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("message_reads")
        .update({ last_read_at: readAt })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase
        .from("message_reads")
        .insert({ user_id: user.id, channel_id: channelId, last_read_at: readAt });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { data: existing } = await supabase
      .from("message_reads")
      .select("id")
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("message_reads")
        .update({ last_read_at: readAt })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase
        .from("message_reads")
        .insert({ user_id: user.id, conversation_id: conversationId, last_read_at: readAt });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
