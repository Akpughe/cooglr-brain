import { decrypt } from "@/lib/crypto";
import { createDbAdapter } from "@/lib/db-adapter";
import { sqlDigTool } from "./dig/sql-dig";
import { runQueryLoop, planQuery, synthesizeAnswer } from "./query";
import type { QueryOutcome } from "./query";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
const MAX_ROWS = 1000;

export class NoMapError extends Error {
  constructor() {
    super("No knowledge map for this connection yet.");
    this.name = "NoMapError";
  }
}

// Answer a question against a connection's DB map: load the map, plan grounded
// SQL, dig live (read-only), synthesize. Shared by /api/knowledge/query and the
// unified router. Logs the trace to knowledge_query_log.
export async function runDbQuery(
  supabase: SupabaseServerClient,
  opts: { workspaceId: string; connectionId: string; question: string; userId: string },
): Promise<QueryOutcome> {
  const { workspaceId, connectionId, question, userId } = opts;

  const { data: pages } = await supabase
    .from("knowledge_pages")
    .select("path, type, title, access_spec")
    .eq("workspace_id", workspaceId)
    .eq("connection_id", connectionId)
    .eq("stale", false);
  if (!pages || pages.length === 0) throw new NoMapError();

  const indexLines = pages.map((p) => `- ${p.path} — ${p.title}`).join("\n");
  const pageSpecs = JSON.stringify(
    pages
      .filter((p) => p.type === "table" || p.type === "metric")
      .map((p) => ({ path: p.path, type: p.type, accessSpec: p.access_spec })),
  );

  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string, db_type, selected_database")
    .eq("id", connectionId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!connection) throw new Error("Connection not found");

  const connectionString = decrypt(connection.encrypted_connection_string);
  const adapter = await createDbAdapter(
    connection.db_type,
    connectionString,
    connection.selected_database || undefined,
  );
  try {
    const outcome = await runQueryLoop(question, {
      plan: () => planQuery(question, indexLines, pageSpecs),
      dig: (plan) =>
        sqlDigTool.run(plan, { connectionId, maxRows: MAX_ROWS, query: (sql) => adapter.runReadOnly(sql) }),
      synthesize: (q, plan, dig) => synthesizeAnswer(q, plan, dig),
    });

    await supabase.from("knowledge_query_log").insert({
      workspace_id: workspaceId,
      user_id: userId,
      question,
      plan: outcome.plan,
      sql_executed: outcome.dig.sql,
      row_count: outcome.dig.rowCount,
      answer_md: outcome.answerMd,
      citations: outcome.plan.pagePaths,
    });
    return outcome;
  } finally {
    await adapter.close();
  }
}
