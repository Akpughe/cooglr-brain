import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// GET /api/messages/[targetId]?type=channel|dm&cursor=timestamp&limit=50
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  const { targetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") || "channel";
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const filterCol = type === "dm" ? "conversation_id" : "channel_id";

  let query = supabase
    .from("messages")
    .select("*, profiles:sender_id (full_name, avatar_url)")
    .eq(filterCol, targetId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = (data || []).map((m) => ({
    id: m.id,
    workspaceId: m.workspace_id,
    channelId: m.channel_id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    senderName: (m.profiles as any)?.full_name || "Unknown",
    senderAvatar: (m.profiles as any)?.avatar_url || null,
    content: m.content,
    attachments: m.attachments || [],
    editedAt: m.edited_at,
    createdAt: m.created_at,
  }));

  return NextResponse.json({ messages, hasMore: messages.length === limit });
}

// POST /api/messages/[targetId]?type=channel|dm
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  const { targetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") || "channel";
  const { content, attachments, workspaceId } = await request.json();

  if (!content && (!attachments || attachments.length === 0)) {
    return NextResponse.json({ error: "Content or attachments required" }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
    workspace_id: workspaceId,
    sender_id: user.id,
    content: content || "",
    attachments: attachments || [],
  };

  if (type === "dm") insertData.conversation_id = targetId;
  else insertData.channel_id = targetId;

  const { data, error } = await supabase
    .from("messages")
    .insert(insertData)
    .select("*, profiles:sender_id (full_name, avatar_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    message: {
      id: data.id, workspaceId: data.workspace_id, channelId: data.channel_id,
      conversationId: data.conversation_id, senderId: data.sender_id,
      senderName: (data.profiles as any)?.full_name || "Unknown",
      senderAvatar: (data.profiles as any)?.avatar_url || null,
      content: data.content, attachments: data.attachments || [],
      editedAt: data.edited_at, createdAt: data.created_at,
    },
  }, { status: 201 });
}
