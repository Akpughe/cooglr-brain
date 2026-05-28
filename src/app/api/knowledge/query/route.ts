import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { createDbAdapter } from "@/lib/db-adapter";
import { sqlDigTool } from "@/lib/knowledge/dig/sql-dig";
import { runQueryLoop, planQuery, synthesizeAnswer } from "@/lib/knowledge/query";

const MAX_ROWS = 1000;

// POST /api/knowledge/query — answer a question via Plan -> Dig -> Synthesize.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, connectionId, question } = await request.json();
  if (!workspaceId || !connectionId || !question) {
    return NextResponse.json({ error: "workspaceId, connectionId and question required" }, { status: 400 });
  }

  // Load the map for this connection (RLS scopes to the workspace).
  const { data: pages } = await supabase
    .from("knowledge_pages")
    .select("path, type, title, access_spec")
    .eq("workspace_id", workspaceId)
    .eq("connection_id", connectionId);

  if (!pages || pages.length === 0) {
    return NextResponse.json({ error: "No knowledge map for this connection yet. Build it first." }, { status: 409 });
  }

  const indexLines = pages.map((p) => `- ${p.path} — ${p.title}`).join("\n");
  const pageSpecs = JSON.stringify(
    pages.map((p) => ({ path: p.path, type: p.type, accessSpec: p.access_spec })),
  );

  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string, db_type, selected_database")
    .eq("id", connectionId)
    .single();
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let connectionString: string;
  try {
    connectionString = decrypt(connection.encrypted_connection_string);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt connection" }, { status: 500 });
  }

  try {
    const adapter = await createDbAdapter(connection.db_type, connectionString, connection.selected_database || undefined);
    const outcome = await runQueryLoop(question, {
      plan: () => planQuery(question, indexLines, pageSpecs),
      dig: (plan) =>
        sqlDigTool.run(plan, {
          connectionId,
          maxRows: MAX_ROWS,
          query: (sql) => adapter.query(sql),
        }),
      synthesize: (q, plan, dig) => synthesizeAnswer(q, plan, dig),
    });
    await adapter.close();

    await supabase.from("knowledge_query_log").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      question,
      plan: outcome.plan,
      sql_executed: outcome.dig.sql,
      row_count: outcome.dig.rowCount,
      answer_md: outcome.answerMd,
      citations: outcome.plan.pagePaths,
    });

    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Query failed" }, { status: 500 });
  }
}
