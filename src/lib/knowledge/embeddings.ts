// Embeddings via Voyage AI. Behind one helper so the provider is swappable.
// voyage-3.5 → 1024 dims. input_type matters: "document" when indexing,
// "query" when searching (Voyage embeds them into a shared space optimized for
// retrieval).

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
export const EMBED_MODEL =
  process.env.VOYAGE_EMBED_MODEL || process.env.KNOWLEDGE_EMBED_MODEL || "voyage-3.5";
export const EMBED_DIMS = Number(
  process.env.VOYAGE_EMBED_DIM || process.env.KNOWLEDGE_EMBED_DIMS || 1024,
);

// Keep each request well under Voyage's free-tier 10K tokens/min cap; ~4 chars
// per token, so a ~24K-char budget ≈ 6K tokens leaves headroom.
const BATCH_CHAR_BUDGET = 24000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(
  input: string[],
  inputType: "document" | "query",
  attempt = 0,
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not configured");
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // Pin output_dimension so vectors match the Qdrant collection size exactly.
    body: JSON.stringify({ input, model: EMBED_MODEL, input_type: inputType, output_dimension: EMBED_DIMS }),
  });
  // Back off on rate limits (free tier is 3 RPM / 10K TPM).
  if (res.status === 429 && attempt < 6) {
    const retryAfter = Number(res.headers.get("retry-after")) || 21;
    await sleep(retryAfter * 1000);
    return embedBatch(input, inputType, attempt + 1);
  }
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// Batch by character budget so no single request trips the token-per-minute cap.
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  let batch: string[] = [];
  let chars = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    out.push(...(await embedBatch(batch, "document")));
    batch = [];
    chars = 0;
  };
  for (const t of texts) {
    if (chars + t.length > BATCH_CHAR_BUDGET && batch.length > 0) await flush();
    batch.push(t);
    chars += t.length;
  }
  await flush();
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embedBatch([text], "query"))[0];
}
