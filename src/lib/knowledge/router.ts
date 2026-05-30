import { complete, BULK_MODEL } from "./llm";
import { runDbQuery } from "./db-query";
import { runContentQuery } from "./content-query";
import { getContentMap, contentMapOverview } from "./content-understanding";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type Source = "database" | "content";

export interface UnifiedAnswer {
  source: Source;
  answerMd: string;
  // database
  sql?: string;
  rowCount?: number;
  chart?: unknown;
  connectionId?: string;
  // content
  citations?: { fileId: string; score: number }[];
  origins?: string[]; // human labels: e.g. ["Gmail"], ["a database"]
}

// What can this workspace answer from? A DB connection with a built map, and/or
// an ingested document corpus.
export async function detectSources(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<{ dbConnectionId: string | null; hasContent: boolean }> {
  const { data: mapPage } = await supabase
    .from("knowledge_pages")
    .select("connection_id")
    .eq("workspace_id", workspaceId)
    .eq("stale", false)
    .limit(1)
    .maybeSingle();

  const { count } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  return { dbConnectionId: mapPage?.connection_id ?? null, hasContent: (count ?? 0) > 0 };
}

// Pick the source. Shortcut when only one is available; otherwise ask the model.
export async function classify(question: string, hasDb: boolean, hasContent: boolean): Promise<Source> {
  if (hasDb && !hasContent) return "database";
  if (hasContent && !hasDb) return "content";
  // Routing is a trivial classification — use the fast model, not the reasoning
  // one, so the router adds ~1s instead of ~20-50s when both sources exist.
  const t = await complete(
    "You route a question to a data source. 'database' = structured records, counts, metrics, tables, rows. 'content' = documents, notes, emails, files, prose.",
    `Question: ${question}\n\nReply with exactly one word: database OR content.`,
    BULK_MODEL,
  );
  return /content/i.test(t) ? "content" : "database";
}

// One question in → routed answer out. The seed of the agentic harness.
export async function runUnifiedQuery(
  supabase: SupabaseServerClient,
  opts: { workspaceId: string; question: string; userId: string },
): Promise<UnifiedAnswer> {
  const { workspaceId, question, userId } = opts;
  const { dbConnectionId, hasContent } = await detectSources(supabase, workspaceId);

  if (!dbConnectionId && !hasContent) {
    return { source: "content", answerMd: "This workspace has no knowledge yet — build a database map or index some documents first.", citations: [] };
  }

  const source = await classify(question, Boolean(dbConnectionId), hasContent);

  if (source === "database" && dbConnectionId) {
    const r = await runDbQuery(supabase, { workspaceId, connectionId: dbConnectionId, question, userId });
    return {
      source: "database",
      answerMd: r.answerMd,
      sql: r.dig.sql,
      rowCount: r.dig.rowCount,
      chart: r.chart,
      connectionId: dbConnectionId,
      origins: ["a database"],
    };
  }

  const map = await getContentMap(supabase, workspaceId);
  const c = await runContentQuery(workspaceId, question, {
    mapOverview: contentMapOverview(map),
    categories: map.categories.map((x) => x.name),
  });
  return { source: "content", answerMd: c.answerMd, citations: c.citations, origins: c.origins };
}
