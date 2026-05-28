import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runUnifiedQuery } from "@/lib/knowledge/router";

// POST /api/knowledge/ask — one question, auto-routed to the DB map (SQL dig) or
// the document corpus (vector dig). The unified "ask your workspace" endpoint.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, question } = await request.json();
  if (!workspaceId || !question) {
    return NextResponse.json({ error: "workspaceId and question required" }, { status: 400 });
  }

  // Membership check (RLS-backed) — knowledge_pages is RLS-scoped, so a non-member
  // resolves to no sources; this gives a clean 403 instead.
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const answer = await runUnifiedQuery(supabase, { workspaceId, question, userId: user.id });
    return NextResponse.json(answer);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Query failed" }, { status: 500 });
  }
}
