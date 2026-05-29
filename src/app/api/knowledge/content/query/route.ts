import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runContentQuery } from "@/lib/knowledge/content-query";
import { getContentMap, contentMapOverview } from "@/lib/knowledge/content-understanding";

// POST /api/knowledge/content/query — ask a question over the workspace's
// document corpus (RAG: embed -> Qdrant search -> grounded answer).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, question } = await request.json();
  if (!workspaceId || !question) {
    return NextResponse.json({ error: "workspaceId and question required" }, { status: 400 });
  }

  // Confirm membership before querying the workspace's corpus (Qdrant has no RLS;
  // this read is RLS-checked, so a non-member gets no rows and we 403).
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const map = await getContentMap(supabase, workspaceId);
    const answer = await runContentQuery(workspaceId, question, {
      mapOverview: contentMapOverview(map),
      categories: map.categories.map((x) => x.name),
    });
    return NextResponse.json(answer);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Query failed" }, { status: 500 });
  }
}
