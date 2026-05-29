import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestToolkit, INGESTABLE_TOOLKITS } from "@/lib/composio/toolkit-ingest";

// POST /api/composio/ingest { workspaceId, toolkit, max? } — pull the connected
// toolkit's content into the RAG corpus (incrementally, since last sync).
// Supports gmail / slack / github / google-drive.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, toolkit, max } = await request.json();
  if (!workspaceId || !INGESTABLE_TOOLKITS.includes(toolkit)) {
    return NextResponse.json({ error: `workspaceId and a supported toolkit (${INGESTABLE_TOOLKITS.join(", ")}) required` }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await ingestToolkit(supabase, { workspaceId, userId: user.id, toolkit, max });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Ingest failed" }, { status: 500 });
  }
}
