import { complete, BULK_MODEL } from "./llm";
import { ultramem } from "@/lib/memory/ultramem-client";
import { scopes } from "@/lib/memory/scopes";

export interface ContentAnswer {
  answerMd: string;
  citations: { fileId: string; score: number }[];
  chunksUsed: number;
  category?: string | null;
  origins?: string[]; // human labels of where the answer came from (e.g. ["Gmail"])
}

// Human label for a memory's origin, derived from its `source` field.
const ORIGIN_LABELS: Record<string, string> = {
  gmail: "Gmail",
  slack: "Slack",
  github: "GitHub",
  "google-drive": "Google Drive",
  file: "documents",
  manual: "documents",
  memory: "memory",
};
function originLabel(source?: string): string {
  return (source && ORIGIN_LABELS[source]) || "documents";
}

// Kept for callers that still scope a search to a category (unused by the
// UltraMem path, which scopes by container_tag instead).
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

// Content query, UltraMem-backed: semantic-search the workspace's memory, then
// synthesize an answer grounded ONLY in the retrieved excerpts (with citations).
// Pure UltraMem — no Qdrant fallback (by design, for now).
export async function runContentQuery(
  workspaceId: string,
  question: string,
  opts: { topK?: number; mapOverview?: string; categories?: string[] } = {},
): Promise<ContentAnswer> {
  const topK = opts.topK ?? 8;
  const containerTag = scopes.workspace(workspaceId);

  // Never let a memory-service hiccup blank the whole agent turn.
  let res: Awaited<ReturnType<typeof ultramem.search>>;
  try {
    res = await ultramem.search({ query: question, containerTag, limit: topK });
  } catch (err) {
    console.error("[runContentQuery] UltraMem search failed", err);
    return {
      answerMd: "I couldn't reach the workspace memory just now — please try again in a moment.",
      citations: [],
      chunksUsed: 0,
      category: null,
      origins: [],
    };
  }

  // Flatten document snippets + standalone memory facts into citable excerpts.
  type Excerpt = { fileId: string; source?: string; text: string };
  const docExcerpts: Excerpt[] = res.documents.flatMap((d) =>
    d.snippets.map((s) => ({ fileId: d.reference || d.id, source: d.source, text: s })),
  );
  const memExcerpts: Excerpt[] = res.memories.map((m, i) => ({
    fileId: `memory:${i + 1}`,
    source: "memory",
    text: m,
  }));
  const all = [...docExcerpts, ...memExcerpts];

  if (all.length === 0) {
    return {
      answerMd: "I couldn't find anything relevant in this workspace's memory yet.",
      citations: [],
      chunksUsed: 0,
      category: null,
      origins: [],
    };
  }

  const excerpts = all.map((e, i) => `[#${i + 1} ${e.source ?? "doc"}:${e.fileId}]\n${e.text}`).join("\n\n");
  const citations = all.map((e) => ({ fileId: e.fileId, score: 1 }));
  const originsForHit = (() => {
    const o = [...new Set(res.documents.map((d) => originLabel(d.source)))];
    if (memExcerpts.length) o.push("memory");
    return [...new Set(o)];
  })();

  // Fast model for synthesis — answers in seconds, not minutes. Guard it: if the
  // model provider is down, still surface the sources we DID find (so this reads
  // as "model unavailable", not a misleading "no sources").
  let answerMd: string;
  try {
    answerMd = await complete(
      "You answer using ONLY the provided excerpts from the workspace's memory. Use clean Markdown (bold, lists). Cite excerpts inline as [#n]. If the answer is not in them, say you don't have it — never invent.",
      `${opts.mapOverview ? `Workspace context: ${opts.mapOverview}\n\n` : ""}Question: ${question}\n\nExcerpts:\n${excerpts}`,
      BULK_MODEL,
    );
  } catch (err) {
    console.error("[runContentQuery] synthesis failed", err);
    return {
      answerMd:
        `I found **${citations.length} relevant source${citations.length === 1 ? "" : "s"}** in this workspace, but couldn't generate the answer just now — the language model is temporarily unavailable. Please try again in a moment.`,
      citations,
      chunksUsed: all.length,
      category: null,
      origins: originsForHit,
    };
  }

  return { answerMd, citations, chunksUsed: all.length, category: null, origins: originsForHit };
}
