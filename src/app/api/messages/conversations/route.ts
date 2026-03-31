import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// GET /api/messages/conversations?workspaceId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const { data: memberRows, error } = await supabase
    .from("direct_conversation_members")
    .select("conversation_id, direct_conversations!inner (id, workspace_id, created_at)")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const serviceClient = await createServiceClient();
  const conversations = [];

  for (const row of memberRows || []) {
    const convo = row.direct_conversations as any;
    if (convo?.workspace_id !== workspaceId) continue;

    const { data: otherMembers } = await serviceClient
      .from("direct_conversation_members")
      .select("user_id, profiles:user_id (full_name, email, avatar_url)")
      .eq("conversation_id", row.conversation_id)
      .neq("user_id", user.id);

    const other = otherMembers?.[0];
    if (!other) continue;

    conversations.push({
      id: convo.id,
      workspaceId: convo.workspace_id,
      createdAt: convo.created_at,
      otherUser: {
        id: other.user_id,
        fullName: (other.profiles as any)?.full_name || "",
        email: (other.profiles as any)?.email || "",
        avatarUrl: (other.profiles as any)?.avatar_url || null,
      },
    });
  }

  return NextResponse.json({ conversations });
}

// POST /api/messages/conversations — create or find existing DM
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, otherUserId } = await request.json();
  if (!workspaceId || !otherUserId) return NextResponse.json({ error: "workspaceId and otherUserId required" }, { status: 400 });
  if (otherUserId === user.id) return NextResponse.json({ error: "Cannot create DM with yourself" }, { status: 400 });

  const serviceClient = await createServiceClient();

  const { data: myConvos } = await serviceClient
    .from("direct_conversation_members").select("conversation_id").eq("user_id", user.id);
  const { data: theirConvos } = await serviceClient
    .from("direct_conversation_members").select("conversation_id").eq("user_id", otherUserId);

  const myIds = new Set((myConvos || []).map((r) => r.conversation_id));
  const sharedConvoIds = (theirConvos || []).filter((r) => myIds.has(r.conversation_id)).map((r) => r.conversation_id);

  if (sharedConvoIds.length > 0) {
    const { data: existing } = await serviceClient
      .from("direct_conversations").select("id").eq("workspace_id", workspaceId).in("id", sharedConvoIds).limit(1).single();
    if (existing) return NextResponse.json({ conversation: { id: existing.id }, existing: true });
  }

  const { data: convo, error: convoError } = await serviceClient
    .from("direct_conversations").insert({ workspace_id: workspaceId }).select().single();
  if (convoError) return NextResponse.json({ error: convoError.message }, { status: 500 });

  const { error: membersError } = await serviceClient
    .from("direct_conversation_members")
    .insert([
      { conversation_id: convo.id, user_id: user.id },
      { conversation_id: convo.id, user_id: otherUserId },
    ]);
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });

  return NextResponse.json({ conversation: { id: convo.id }, existing: false }, { status: 201 });
}
