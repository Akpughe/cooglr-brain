import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestGmail } from "@/lib/composio/gmail-ingest";

// POST /api/composio/ingest — pull the connected toolkit's content into the RAG
// corpus (v1: Gmail). Requires the user to have connected the toolkit first.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, toolkit, max } = await request.json();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  if (toolkit !== "gmail") {
    // OAuth connect works for all toolkits; ingest adapters beyond Gmail are next.
    return NextResponse.json({ error: `Ingest for '${toolkit}' isn't available yet — only Gmail. You can still connect it.` }, { status: 400 });
  }

  // Membership check (RLS-backed).
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await ingestGmail(supabase, { workspaceId, userId: user.id, max });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Ingest failed" }, { status: 500 });
  }
}
