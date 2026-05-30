import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "node:crypto";
import { EMBED_DIMS } from "./embeddings";

export const COLLECTION = process.env.QDRANT_COLLECTION || "500Claw";

export interface ChunkPoint {
  workspaceId: string;
  fileId: string;
  chunkIndex: number;
  text: string;
  vector: number[];
  category?: string;
  source?: string; // gmail | github | slack | google-drive | file
}

export interface ChunkHit {
  fileId: string;
  chunkIndex: number;
  text: string;
  score: number;
  category?: string;
  source?: string;
}

let client: QdrantClient | null = null;
function getClient(): QdrantClient {
  if (client) return client;
  const raw = process.env.QDRANT_URL;
  if (!raw) throw new Error("QDRANT_URL not configured");
  // Parse explicitly — the client otherwise defaults to port 6333 and ignores a
  // :443 in the URL, so hosted instances behind HTTPS time out.
  const u = new URL(raw);
  const https = u.protocol === "https:";
  client = new QdrantClient({
    host: u.hostname,
    https,
    port: u.port ? Number(u.port) : https ? 443 : 6333,
    apiKey: process.env.QDRANT_API_KEY,
    checkCompatibility: false,
  });
  return client;
}

// Deterministic UUID for a chunk so re-ingest overwrites instead of duplicating.
export function pointId(workspaceId: string, fileId: string, chunkIndex: number): string {
  const h = createHash("sha1").update(`${workspaceId}:${fileId}:${chunkIndex}`).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join("-");
}

// Create the collection if missing (Cosine distance, embedding dims).
export async function ensureCollection(): Promise<void> {
  const c = getClient();
  const { collections } = await c.getCollections();
  if (collections.some((x) => x.name === COLLECTION)) return;
  await c.createCollection(COLLECTION, {
    vectors: { size: EMBED_DIMS, distance: "Cosine" },
  });
  // Index the tenancy key so filtered searches stay fast.
  await c.createPayloadIndex(COLLECTION, { field_name: "workspace_id", field_schema: "keyword" });
}

export async function upsertChunks(points: ChunkPoint[]): Promise<void> {
  if (points.length === 0) return;
  const c = getClient();
  await c.upsert(COLLECTION, {
    points: points.map((p) => ({
      id: pointId(p.workspaceId, p.fileId, p.chunkIndex),
      vector: p.vector,
      payload: {
        workspace_id: p.workspaceId,
        file_id: p.fileId,
        chunk_index: p.chunkIndex,
        text: p.text,
        ...(p.category ? { category: p.category } : {}),
        ...(p.source ? { source: p.source } : {}),
      },
    })),
  });
}

// Similarity search scoped to a workspace (tenancy filter — Qdrant has no RLS),
// optionally narrowed by content category and/or source (the map planning the dig).
export async function search(
  workspaceId: string,
  vector: number[],
  topK: number,
  filters?: { category?: string; source?: string },
): Promise<ChunkHit[]> {
  const c = getClient();
  const must: Record<string, unknown>[] = [{ key: "workspace_id", match: { value: workspaceId } }];
  if (filters?.category) must.push({ key: "category", match: { value: filters.category } });
  if (filters?.source) must.push({ key: "source", match: { value: filters.source } });
  const res = await c.search(COLLECTION, {
    vector,
    limit: topK,
    filter: { must },
    with_payload: true,
  });
  return res.map((r) => {
    const p = (r.payload ?? {}) as { file_id?: string; chunk_index?: number; text?: string; category?: string; source?: string };
    return { fileId: p.file_id ?? "", chunkIndex: p.chunk_index ?? 0, text: p.text ?? "", score: r.score, category: p.category, source: p.source };
  });
}

// Remove all chunks for one file (used before re-ingesting it).
export async function deleteFileChunks(workspaceId: string, fileId: string): Promise<void> {
  const c = getClient();
  await c.delete(COLLECTION, {
    filter: {
      must: [
        { key: "workspace_id", match: { value: workspaceId } },
        { key: "file_id", match: { value: fileId } },
      ],
    },
  });
}
