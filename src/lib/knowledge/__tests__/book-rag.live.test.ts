// Embed real cached book markdown -> 500Claw -> query. Proves the embed-throttle
// + storage + retrieval on real content without re-running Nuton each time.
// Gated: RUN_BOOKS=1 + creds + the cached markdown file present.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { chunkText } from "../chunk";
import { embedDocuments } from "../embeddings";
import { ensureCollection, upsertChunks, deleteFileChunks, COLLECTION } from "../qdrant";
import { runContentQuery } from "../content-query";

const MD = "/tmp/ai-eng-25.md";
const ready =
  process.env.RUN_BOOKS === "1" &&
  Boolean(process.env.QDRANT_URL) &&
  Boolean(process.env.VOYAGE_API_KEY) &&
  Boolean(process.env.FIREWORKS_API_KEY) &&
  existsSync(MD);

describe.skipIf(!ready)("book RAG — real book content into 500Claw", () => {
  it("chunks, embeds (throttled), indexes, and answers", { timeout: 600000 }, async () => {
    console.log("COLLECTION:", COLLECTION);
    await ensureCollection();
    const ws = "books-500claw";
    const fileId = "ai-engineering";

    const text = readFileSync(MD, "utf8");
    const chunks = chunkText(text);
    console.log(`CHUNKS: ${chunks.length} from ${text.length} chars`);

    const vectors = await embedDocuments(chunks);
    expect(vectors[0].length).toBe(1024);
    await deleteFileChunks(ws, fileId);
    await upsertChunks(chunks.map((t, i) => ({ workspaceId: ws, fileId, chunkIndex: i, text: t, vector: vectors[i] })));
    console.log(`INDEXED ${chunks.length} chunks into ${COLLECTION}`);

    const ans = await runContentQuery(ws, "What is AI Engineering about, and who wrote it?");
    console.log("ANSWER:", ans.answerMd);
    console.log("CITATIONS:", JSON.stringify(ans.citations.slice(0, 3)));
    expect(ans.chunksUsed).toBeGreaterThan(0);
    expect(ans.answerMd.toLowerCase()).toMatch(/foundation model|application|huyen|ai engineering/);
  });
});
