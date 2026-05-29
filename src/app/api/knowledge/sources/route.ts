import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/knowledge/sources?workspaceId= — per-source sync state
// ({ source, last_synced_at, item_count }) for the Integrations UI.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase
    .from("knowledge_sources")
    .select("source, last_synced_at, item_count")
    .eq("workspace_id", workspaceId);
  return NextResponse.json({ sources: data ?? [] });
}
