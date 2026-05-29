import { complete, BULK_MODEL } from "./llm";
import { vectorDigTool } from "./dig/vector-dig";
import type { QueryPlan } from "./types";

export interface ContentAnswer {
  answerMd: string;
  citations: { fileId: string; score: number }[];
  chunksUsed: number;
  category?: string | null;
  origins?: string[]; // human labels of where the answer came from (e.g. ["Gmail"])
}

// Human label for a chunk's origin, derived from its Qdrant fileId prefix.
const ORIGIN_LABELS: Record<string, string> = {
  gmail: "Gmail", slack: "Slack", github: "GitHub", "google-drive": "Google Drive", file: "documents",
};
function originOf(fileId: string): string {
  const prefix = fileId.includes(":") ? fileId.split(":")[0] : "file";
  return ORIGIN_LABELS[prefix] ?? "documents";
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

  // Map plans the dig: scope to a category when one clearly fits. But if the
  // question names a SOURCE (gmail/github/slack/drive/...), don't narrow by
  // content-category — let vector relevance surface that source's docs.
  const namesSource = /\b(gmail|e?mails?|github|repos?|repositor|slack|drive|docs?|documents?|files?)\b/i.test(question);
  const category = opts.categories?.length && !namesSource ? await pickCategory(question, opts.categories) : null;
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

  // Use the fast model for synthesis — keeps answers in seconds, not minutes.
  const answerMd = await complete(
    "You answer using ONLY the provided excerpts. Use clean Markdown (bold, lists). Cite excerpts inline as [#n]. If the answer is not in them, say you don't have it — never invent.",
    `${opts.mapOverview ? `Workspace context: ${opts.mapOverview}\n\n` : ""}Question: ${question}\n\nExcerpts:\n${excerpts}`,
    BULK_MODEL,
  );

  const citations = dig.rows.map((r) => ({
    fileId: String(r.file_id),
    score: Number(r.score),
  }));
  const origins = [...new Set(dig.rows.map((r) => originOf(String(r.file_id))))];
  return { answerMd, citations, chunksUsed: dig.rowCount, category, origins };
}
