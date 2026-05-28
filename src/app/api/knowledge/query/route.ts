import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDbQuery, NoMapError } from "@/lib/knowledge/db-query";

// POST /api/knowledge/query — answer a question against a specific connection's
// DB map (Plan -> Dig -> Synthesize). For auto-routing across DB + documents,
// use /api/knowledge/ask.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, connectionId, question } = await request.json();
  if (!workspaceId || !connectionId || !question) {
    return NextResponse.json({ error: "workspaceId, connectionId and question required" }, { status: 400 });
  }

  try {
    const outcome = await runDbQuery(supabase, { workspaceId, connectionId, question, userId: user.id });
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof NoMapError) {
      return NextResponse.json(
        { error: "No knowledge map for this connection yet. Build it first." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Query failed" }, { status: 500 });
  }
}
