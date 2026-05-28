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

  // RLS scopes knowledge_pages; a non-member sees nothing.
  const map = await getContentMap(supabase, workspaceId);
  return NextResponse.json(map);
}
