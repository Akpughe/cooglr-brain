import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "node:crypto";
import { EMBED_DIMS } from "./embeddings";

export const COLLECTION = "knowledge_content";

export interface ChunkPoint {
  workspaceId: string;
  fileId: string;
  chunkIndex: number;
  text: string;
  vector: number[];
}

export interface ChunkHit {
  fileId: string;
  chunkIndex: number;
  text: string;
  score: number;
}

let client: QdrantClient | null = null;
function getClient(): QdrantClient {
  if (client) return client;
  const url = process.env.QDRANT_URL;
  if (!url) throw new Error("QDRANT_URL not configured");
  client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
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
      payload: { workspace_id: p.workspaceId, file_id: p.fileId, chunk_index: p.chunkIndex, text: p.text },
    })),
  });
}

// Similarity search scoped to a workspace (tenancy filter — Qdrant has no RLS).
export async function search(workspaceId: string, vector: number[], topK: number): Promise<ChunkHit[]> {
  const c = getClient();
  const res = await c.search(COLLECTION, {
    vector,
    limit: topK,
    filter: { must: [{ key: "workspace_id", match: { value: workspaceId } }] },
    with_payload: true,
  });
  return res.map((r) => {
    const p = (r.payload ?? {}) as { file_id?: string; chunk_index?: number; text?: string };
    return { fileId: p.file_id ?? "", chunkIndex: p.chunk_index ?? 0, text: p.text ?? "", score: r.score };
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
