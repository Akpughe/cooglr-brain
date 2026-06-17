import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// GET /api/agent/threads?workspaceId=X — list this user's recent agent threads
// in the workspace (most-recent first). Used by the sidebar.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // Membership check (service client; client-provided id is a hint).
  const svc = await createServiceClient();
  const { data: membership } = await svc
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await svc
    .from("agent_threads")
    .select("id, title, pinned, last_message_at")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .order("last_message_at", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ threads: [] });

  const threads = (data || []).map((t) => ({
    id: t.id as string,
    title: (t.title as string) || "New chat",
    pinned: Boolean(t.pinned),
    lastMessageAt: (t.last_message_at as string) ?? null,
  }));

  return NextResponse.json({ threads });
}
