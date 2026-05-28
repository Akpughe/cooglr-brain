import { complete } from "./llm";
import { vectorDigTool } from "./dig/vector-dig";
import type { QueryPlan } from "./types";

export interface ContentAnswer {
  answerMd: string;
  citations: { fileId: string; score: number }[];
  chunksUsed: number;
}

// Content RAG query: embed the question, vector-search the workspace's corpus,
// synthesize an answer grounded ONLY in the retrieved excerpts (with citations).
export async function runContentQuery(
  workspaceId: string,
  question: string,
  topK = 8,
): Promise<ContentAnswer> {
  const plan: QueryPlan = {
    question,
    pagePaths: [],
    tables: [],
    sql: "",
    search: question,
    wantsChart: false,
  };
  const dig = await vectorDigTool.run(plan, { workspaceId, maxRows: topK });

  if (dig.rowCount === 0) {
    return { answerMd: "I couldn't find anything relevant in this workspace's documents.", citations: [], chunksUsed: 0 };
  }

  const excerpts = dig.rows
    .map((r, i) => `[#${i + 1} file:${r.file_id}]\n${r.text}`)
    .join("\n\n");

  const answerMd = await complete(
    "You answer using ONLY the provided document excerpts. Cite excerpts inline as [#n]. If the answer is not in them, say you don't have it — never invent.",
    `Question: ${question}\n\nExcerpts:\n${excerpts}`,
  );

  const citations = dig.rows.map((r) => ({
    fileId: String(r.file_id),
    score: Number(r.score),
  }));
  return { answerMd, citations, chunksUsed: dig.rowCount };
}
