import type { QueryPlan, DigResult } from "../types";
import type { DigTool, DigContext } from "./types";
import { embedQuery } from "../embeddings";
import { search } from "../qdrant";

// Vector dig tool: embed the question, similarity-search Qdrant scoped to the
// workspace, return the top chunks. The RAG counterpart to sqlDigTool — the
// agentic harness (SP3) routes content questions here, SQL questions to SQL.
export const vectorDigTool: DigTool = {
  name: "vector",

  canHandle(plan: QueryPlan): boolean {
    // Handles semantic-search plans (no SQL, a search string present).
    return !plan.sql && typeof plan.search === "string" && plan.search.trim().length > 0;
  },

  async run(plan: QueryPlan, ctx: DigContext): Promise<DigResult> {
    const vector = await embedQuery(plan.search!);
    const hits = await search(ctx.workspaceId!, vector, ctx.maxRows);
    return {
      tool: "vector",
      columns: ["file_id", "chunk_index", "text", "score"],
      rows: hits.map((h) => ({ file_id: h.fileId, chunk_index: h.chunkIndex, text: h.text, score: h.score })),
      rowCount: hits.length,
    };
  },
};
