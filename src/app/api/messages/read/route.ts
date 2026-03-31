import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId, conversationId, lastReadAt } = await request.json();
  if (!channelId && !conversationId) return NextResponse.json({ error: "channelId or conversationId required" }, { status: 400 });

  const target = channelId
    ? { channel_id: channelId, conversation_id: null }
    : { channel_id: null, conversation_id: conversationId };

  const { error } = await supabase
    .from("message_reads")
    .upsert(
      { user_id: user.id, ...target, last_read_at: lastReadAt || new Date().toISOString() },
      { onConflict: channelId ? "user_id,channel_id" : "user_id,conversation_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
