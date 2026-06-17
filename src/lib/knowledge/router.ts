import { complete, BULK_MODEL } from "./llm";
import { runDbQuery } from "./db-query";
import { runContentQuery } from "./content-query";
import { getContentMap, contentMapOverview } from "./content-understanding";
import type { QueryOutcome } from "./query";
import type { ChartSpec, TableSpec } from "./chart-builder";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type Source = "database" | "content";

export interface UnifiedAnswer {
  source: Source;
  answerMd: string;
  // database
  sql?: string;
  rowCount?: number;
  chart?: ChartSpec | null;
  table?: TableSpec; // downloadable table computed from the real SQL rows
  connectionId?: string;
  // content
  citations?: { fileId: string; score: number }[];
  origins?: string[]; // human labels: e.g. ["Gmail"], ["a database"]
}

// Does this workspace have a connected DATABASE with a built understanding/map?
// That's the only structured-data source. Content (documents + chat memory)
// always lives in UltraMem and is queried directly — we deliberately do NOT
// gate it on the Supabase `knowledge_documents` catalog: that catalog is a
// write-only UI status tracker and can drift out of sync with UltraMem (the
// real store), which would silently disable retrieval. UltraMem itself is the
// source of truth for "is there content", via its own empty-result handling.
export async function detectSources(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<{ dbConnectionId: string | null }> {
  const { data: mapPage } = await supabase
    .from("knowledge_pages")
    .select("connection_id")
    .eq("workspace_id", workspaceId)
    .eq("stale", false)
    .not("connection_id", "is", null)
    .limit(1)
    .maybeSingle();

  return { dbConnectionId: mapPage?.connection_id ?? null };
}

// Pick the source. Shortcut when only one is available; otherwise ask the model.
export async function classify(question: string, hasDb: boolean, hasContent: boolean): Promise<Source> {
  if (hasDb && !hasContent) return "database";
  if (hasContent && !hasDb) return "content";
  // Routing is a trivial classification — use the fast model, not the reasoning
  // one, so the router adds ~1s instead of ~20-50s when both sources exist.
  let t: string;
  try {
    t = await complete(
      "You route a question to a data source. 'database' = structured records, counts, metrics, tables, rows. 'content' = documents, notes, emails, files, prose.",
      `Question: ${question}\n\nReply with exactly one word: database OR content.`,
      BULK_MODEL,
    );
  } catch (err) {
    // Model down → default to content (documents/memory), the safer fallback.
    console.error("[classify] routing model failed, defaulting to content", err);
    return "content";
  }
  return /content/i.test(t) ? "content" : "database";
}

// An explicit "database: …" / "db, …" prefix forces a DB-only answer (the user
// is deliberately scoping the query to structured data). Requires a punctuation
// separator so ordinary questions like "what database do we use" don't trip it.
function parseExplicitMode(question: string): { dbOnly: boolean; cleaned: string } {
  const m = question.match(/^\s*(database|db)\s*[:,\-–]\s*/i);
  if (m) {
    const cleaned = question.slice(m[0].length).trim();
    return { dbOnly: cleaned.length > 0, cleaned: cleaned || question };
  }
  return { dbOnly: false, cleaned: question };
}

// Run the content (UltraMem) path with the workspace's content-map overview.
async function runContent(
  supabase: SupabaseServerClient,
  workspaceId: string,
  question: string,
) {
  const map = await getContentMap(supabase, workspaceId);
  return runContentQuery(workspaceId, question, {
    mapOverview: contentMapOverview(map),
    categories: map.categories.map((x) => x.name),
  });
}

type ContentAnswer = Awaited<ReturnType<typeof runContentQuery>>;

// Fold a live-database answer and a documents/memory answer to the SAME question
// into one. We keep the DB's deterministic chart/table; the prose is merged so
// the user sees figures plus supporting context, with sources distinguished.
async function mergeAnswers(
  question: string,
  db: QueryOutcome | null,
  content: ContentAnswer,
): Promise<string> {
  const dbMd = db?.answerMd?.trim();
  const contentMd = content.answerMd?.trim();
  const contentHasData = Boolean(contentMd) && (content.citations?.length ?? 0) > 0;

  if (dbMd && contentHasData) {
    try {
      return await complete(
        "You merge two grounded answers to the SAME question — one from the company's connected DATABASE (live structured data) and one from its DOCUMENTS and chat MEMORY. Produce ONE coherent Markdown answer. Lead with the database figures, then fold in supporting context from documents/memory. Make the source of each fact clear. Use ONLY what the two answers contain — never invent. If they disagree, say so plainly.",
        `Question: ${question}\n\n--- Database answer ---\n${dbMd}\n\n--- Documents & memory answer ---\n${contentMd}`,
      );
    } catch {
      // Merge model down → return both, clearly separated, rather than nothing.
      return `${dbMd}\n\n---\n\n**From documents & memory:**\n\n${contentMd}`;
    }
  }
  // Only one side has substance (or the DB call failed): use whichever answered.
  return dbMd || contentMd || "I couldn't find anything for this in the database or the workspace's memory.";
}

// One question in → routed answer out. The seed of the agentic harness.
//
// Routing model:
//   - No connected database          → content only (UltraMem).
//   - "database: …" explicit prefix  → database only.
//   - Connected database, normal Q   → query BOTH the database and UltraMem and
//                                       merge ("just in case" — data questions
//                                       often want figures + document context).
export async function runUnifiedQuery(
  supabase: SupabaseServerClient,
  opts: { workspaceId: string; question: string; userId: string },
): Promise<UnifiedAnswer> {
  const { workspaceId, userId } = opts;
  const { dbConnectionId } = await detectSources(supabase, workspaceId);
  const { dbOnly, cleaned: question } = parseExplicitMode(opts.question);

  // No database connected → answer purely from UltraMem. UltraMem reports its
  // own emptiness; we no longer pre-empt it with a catalog check.
  if (!dbConnectionId) {
    const c = await runContent(supabase, workspaceId, question);
    return { source: "content", answerMd: c.answerMd, citations: c.citations, origins: c.origins };
  }

  // Explicit DB-only query. Fall back to content if the DB call fails so the
  // turn still answers something.
  if (dbOnly) {
    try {
      const r = await runDbQuery(supabase, { workspaceId, connectionId: dbConnectionId, question, userId });
      return {
        source: "database",
        answerMd: r.answerMd,
        sql: r.dig.sql,
        rowCount: r.dig.rowCount,
        chart: r.chart,
        table: r.table,
        connectionId: dbConnectionId,
        origins: ["a database"],
      };
    } catch (err) {
      console.error("[runUnifiedQuery] DB-only query failed; falling back to content", err);
      const c = await runContent(supabase, workspaceId, question);
      return { source: "content", answerMd: c.answerMd, citations: c.citations, origins: c.origins };
    }
  }

  // Database connected, normal question → query both and merge.
  const [dbRes, contentRes] = await Promise.all([
    runDbQuery(supabase, { workspaceId, connectionId: dbConnectionId, question, userId }).catch((err) => {
      console.error("[runUnifiedQuery] DB query failed during merge; using content only", err);
      return null;
    }),
    runContent(supabase, workspaceId, question),
  ]);

  const answerMd = await mergeAnswers(question, dbRes, contentRes);
  const origins = [...new Set([...(dbRes ? ["a database"] : []), ...(contentRes.origins ?? [])])];
  return {
    source: dbRes ? "database" : "content",
    answerMd,
    sql: dbRes?.dig.sql,
    rowCount: dbRes?.dig.rowCount,
    chart: dbRes?.chart ?? null,
    table: dbRes?.table,
    connectionId: dbRes ? dbConnectionId : undefined,
    citations: contentRes.citations,
    origins,
  };
}
