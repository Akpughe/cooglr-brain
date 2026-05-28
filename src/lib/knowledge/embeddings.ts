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

// Voyage caps inputs per request; batch to stay well under limits.
const BATCH = 100;

async function embedBatch(input: string[], inputType: "document" | "query"): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not configured");
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // Pin output_dimension so vectors match the Qdrant collection size exactly,
    // regardless of the model's native default.
    body: JSON.stringify({ input, model: EMBED_MODEL, input_type: inputType, output_dimension: EMBED_DIMS }),
  });
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  // Preserve input order.
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...(await embedBatch(texts.slice(i, i + BATCH), "document")));
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embedBatch([text], "query"))[0];
}
