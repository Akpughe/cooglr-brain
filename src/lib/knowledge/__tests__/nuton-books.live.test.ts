// Live binary-document path: extract real PDFs via Nuton -> chunk -> Voyage ->
// Qdrant (500Claw collection) -> query. Heavy + billed, so gated behind
// RUN_BOOKS=1 plus all creds.
//   set -a; . ./.env.local; set +a; RUN_BOOKS=1 npx vitest run nuton-books.live
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractViaNuton } from "../extract";
import { chunkText } from "../chunk";
import { embedDocuments } from "../embeddings";
import { ensureCollection, upsertChunks, deleteFileChunks, COLLECTION } from "../qdrant";
import { runContentQuery } from "../content-query";

const BOOKS = [
  {
    id: "ai-engineering",
    name: "AI Engineering.pdf",
    path: "/tmp/ai-eng-25.pdf",
    ask: "What is AI engineering about? Summarize in two sentences.",
  },
  {
    id: "hands-on-llms",
    name: "Hands-On-Large-Language-Models.pdf",
    path: "/tmp/llms-25.pdf",
    ask: "What does this book teach about large language models?",
  },
];

const ready =
  process.env.RUN_BOOKS === "1" &&
  Boolean(process.env.NUTON_KEY) &&
  Boolean(process.env.QDRANT_URL) &&
  Boolean(process.env.VOYAGE_API_KEY) &&
  Boolean(process.env.FIREWORKS_API_KEY);

describe.skipIf(!ready)("Nuton book ingest -> 500Claw collection", () => {
  it("extracts PDFs, indexes them, and answers questions", { timeout: 1200000 }, async () => {
    console.log("COLLECTION:", COLLECTION);
    await ensureCollection();
    const ws = "books-500claw";

    for (const book of BOOKS) {
      const buf = readFileSync(book.path);
      const blob = new Blob([buf], { type: "application/pdf" });

      const t0 = Date.now();
      const text = await extractViaNuton([{ name: book.name, blob }], "books@500chow.com");
      console.log(`EXTRACT ${book.id}: ${text.length} chars in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      expect(text.length).toBeGreaterThan(500);

      const chunks = chunkText(text);
      const vectors = await embedDocuments(chunks);
      await deleteFileChunks(ws, book.id);
      await upsertChunks(chunks.map((t, i) => ({ workspaceId: ws, fileId: book.id, chunkIndex: i, text: t, vector: vectors[i] })));
      console.log(`INDEXED ${book.id}: ${chunks.length} chunks`);

      const ans = await runContentQuery(ws, book.ask);
      console.log(`Q (${book.id}): ${book.ask}`);
      console.log(`A: ${ans.answerMd}\n`);
      expect(ans.chunksUsed).toBeGreaterThan(0);
      expect(ans.answerMd.length).toBeGreaterThan(0);
    }
  });
});
