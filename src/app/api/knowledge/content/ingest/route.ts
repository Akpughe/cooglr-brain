import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestWorkspaceContent } from "@/lib/knowledge/content-ingest";

// POST /api/knowledge/content/ingest — embed the workspace's Files (pages +
// uploads) into the RAG corpus.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await request.json();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  try {
    const results = await ingestWorkspaceContent(supabase, workspaceId, user.email ?? user.id);
    const chunks = results.reduce((n, r) => n + r.chunks, 0);
    return NextResponse.json({
      files: results.length,
      ingested: results.filter((r) => r.chunks > 0).length,
      chunks,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Ingest failed" }, { status: 500 });
  }
}
