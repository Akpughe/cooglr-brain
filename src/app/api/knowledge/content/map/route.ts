import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContentMap } from "@/lib/knowledge/content-understanding";

// GET /api/knowledge/content/map?workspaceId= — the content understanding map:
// categories, topics, and key entities across the workspace's indexed documents.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // Defense-in-depth membership check (in addition to RLS on knowledge_pages),
  // mirroring the other knowledge routes — clean 403 for non-members.
  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const map = await getContentMap(supabase, workspaceId);
  return NextResponse.json(map);
}
