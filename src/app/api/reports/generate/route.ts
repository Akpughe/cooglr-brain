import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planQuery } from "@/lib/knowledge/query";

// POST /api/reports/generate — turn a prompt into SQL.
// Re-pointed (Task 14, full replace): SQL is now PLANNED from the knowledge map
// for the connection instead of guessed from the raw schema. Requires a built
// map (use the Knowledge app to build one). Returns { sql } — same contract as
// before, so the rest of the Reports flow (run via /api/db/query, render) is
// unchanged.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, connectionId, conversationHistory } = await request.json();
  if (!prompt || !connectionId) {
    return NextResponse.json({ error: "Prompt and connectionId required" }, { status: 400 });
  }

  // Load the knowledge map for this connection. RLS scopes knowledge_pages to
  // the user's workspaces, so filtering by connection_id alone is safe.
  const { data: pages } = await supabase
    .from("knowledge_pages")
    .select("path, type, title, access_spec")
    .eq("connection_id", connectionId);

  if (!pages || pages.length === 0) {
    return NextResponse.json(
      { error: "No knowledge map for this connection yet. Open the Knowledge app and build the map first." },
      { status: 409 },
    );
  }

  const indexLines = pages.map((p) => `- ${p.path} — ${p.title}`).join("\n");
  const pageSpecs = JSON.stringify(
    pages
      .filter((p) => p.type === "table" || p.type === "metric")
      .map((p) => ({ path: p.path, type: p.type, accessSpec: p.access_spec })),
  );

  // Fold any conversation history into the question for follow-ups.
  const history = (conversationHistory || [])
    .map((h: { prompt: string; sql: string; rowCount: number }) =>
      `Earlier: "${h.prompt}" → ${h.sql} (${h.rowCount} rows)`)
    .join("\n");
  const question = history ? `${prompt}\n\nContext from earlier in this session:\n${history}` : prompt;

  try {
    const plan = await planQuery(question, indexLines, pageSpecs);
    if (!plan.sql) {
      return NextResponse.json({ error: "Could not plan a query from the map" }, { status: 500 });
    }
    return NextResponse.json({ sql: plan.sql });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Planning failed" }, { status: 500 });
  }
}
