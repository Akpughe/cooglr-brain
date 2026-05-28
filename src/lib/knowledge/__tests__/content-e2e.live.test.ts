// Live RAG smoke: Voyage embeddings + Qdrant + vector dig + synthesis.
// Self-contained (seeds its own chunks, cleans up). Skipped unless the creds
// are present. Run with: set -a; . ./.env.local; set +a; npx vitest run content-e2e.live
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { ensureCollection, upsertChunks, deleteFileChunks } from "../qdrant";
import { embedDocuments } from "../embeddings";
import { runContentQuery } from "../content-query";
import { ingestWorkspaceContent } from "../content-ingest";

const ready =
  Boolean(process.env.QDRANT_URL) &&
  Boolean(process.env.VOYAGE_API_KEY) &&
  Boolean(process.env.FIREWORKS_API_KEY);

describe.skipIf(!ready)("content RAG — live Voyage + Qdrant e2e", () => {
  it("embeds, indexes, retrieves the right chunk, and answers", { timeout: 150000 }, async () => {
    const ws = "e2e-content-ws";
    const file = "e2e-file";
    const docs = [
      "The capital of France is Paris, a major European city.",
      "Our refund policy allows customers to return items within 30 days of purchase for a full refund.",
      "Photosynthesis converts sunlight into chemical energy in plants.",
    ];

    try {
      await ensureCollection();
      const vectors = await embedDocuments(docs);
      expect(vectors[0].length).toBe(1024);
      await upsertChunks(
        docs.map((t, i) => ({ workspaceId: ws, fileId: file, chunkIndex: i, text: t, vector: vectors[i] })),
      );

      const ans = await runContentQuery(ws, "What is our return window?");
      console.log("CHUNKS USED:", ans.chunksUsed);
      console.log("ANSWER:", ans.answerMd);

      expect(ans.chunksUsed).toBeGreaterThan(0);
      expect(ans.answerMd.length).toBeGreaterThan(0);
      // Retrieval should have surfaced the refund policy chunk.
      expect(ans.answerMd.toLowerCase()).toMatch(/30|thirty|return|refund/);
    } finally {
      await deleteFileChunks(ws, file);
    }
  });
});

const ingestReady =
  ready &&
  Boolean(process.env.CONTENT_WS_ID) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!ingestReady)("content RAG — real workspace files", () => {
  it("ingests a workspace's Files and answers a question over them", { timeout: 200000 }, async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const ws = process.env.CONTENT_WS_ID!;
    const userId = process.env.CONTENT_USER_ID || "test@local";

    const results = await ingestWorkspaceContent(
      supabase as unknown as Parameters<typeof ingestWorkspaceContent>[0],
      ws,
      userId,
    );
    const chunks = results.reduce((n, r) => n + r.chunks, 0);
    console.log("INGEST RESULTS:", JSON.stringify(results.map((r) => ({ t: r.title, c: r.chunks, s: r.skipped }))));
    console.log(`TOTAL: ${results.length} files, ${chunks} chunks`);
    expect(chunks).toBeGreaterThan(0);

    const ans = await runContentQuery(ws, "Give me a short summary of what these documents cover.");
    console.log("ANSWER:", ans.answerMd);
    console.log("CITATIONS:", JSON.stringify(ans.citations));
    expect(ans.chunksUsed).toBeGreaterThan(0);
    expect(ans.answerMd.length).toBeGreaterThan(0);
  });
});
