import { complete, BULK_MODEL } from "./llm";
import { vectorDigTool } from "./dig/vector-dig";
import type { QueryPlan } from "./types";

export interface ContentAnswer {
  answerMd: string;
  citations: { fileId: string; score: number }[];
  chunksUsed: number;
  category?: string | null;
}

// The map plans the dig: pick the single most relevant category for the question
// from those that exist, or null to search across all. Returns a category only
// if it clearly matches one in the list.
export async function pickCategory(question: string, categories: string[]): Promise<string | null> {
  if (categories.length === 0) return null;
  const t = await complete(
    "You scope a document search to one category, or decline.",
    `Question: ${question}\n\nAvailable categories: ${categories.join(", ")}\n\nReply with EXACTLY one category from the list if it clearly narrows the search, otherwise reply "none".`,
    BULK_MODEL,
  );
  const norm = t.trim().toLowerCase();
  return categories.find((c) => norm === c.toLowerCase() || norm.includes(c.toLowerCase())) ?? null;
}

// Content RAG query: embed the question, vector-search the workspace's corpus,
// synthesize an answer grounded ONLY in the retrieved excerpts (with citations).
export async function runContentQuery(
  workspaceId: string,
  question: string,
  opts: { topK?: number; mapOverview?: string; categories?: string[] } = {},
): Promise<ContentAnswer> {
  const topK = opts.topK ?? 8;
  const ctx = { workspaceId, maxRows: topK };

  // Map plans the dig: scope to a category when one clearly fits.
  const category = opts.categories?.length ? await pickCategory(question, opts.categories) : null;
  const plan: QueryPlan = {
    question,
    pagePaths: [],
    tables: [],
    sql: "",
    search: question,
    category: category ?? undefined,
    wantsChart: false,
  };

  let dig = await vectorDigTool.run(plan, ctx);
  // Fallback: if the category filter found nothing, search across all categories.
  if (dig.rowCount === 0 && category) {
    dig = await vectorDigTool.run({ ...plan, category: undefined }, ctx);
  }

  if (dig.rowCount === 0) {
    return { answerMd: "I couldn't find anything relevant in this workspace's documents.", citations: [], chunksUsed: 0, category };
  }

  const excerpts = dig.rows
    .map((r, i) => `[#${i + 1} file:${r.file_id}]\n${r.text}`)
    .join("\n\n");

  const answerMd = await complete(
    "You answer using ONLY the provided document excerpts. Cite excerpts inline as [#n]. If the answer is not in them, say you don't have it — never invent.",
    `${opts.mapOverview ? `Workspace context: ${opts.mapOverview}\n\n` : ""}Question: ${question}\n\nExcerpts:\n${excerpts}`,
  );

  const citations = dig.rows.map((r) => ({
    fileId: String(r.file_id),
    score: Number(r.score),
  }));
  return { answerMd, citations, chunksUsed: dig.rowCount, category };
}
