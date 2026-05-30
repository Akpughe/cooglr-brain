import { chunkText } from "./chunk";
import { embedDocuments } from "./embeddings";
import { upsertChunks, deleteFileChunks } from "./qdrant";
import { synthesizeDocument, persistUnderstanding } from "./content-understanding";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Shared content-ingest pipeline for ONE document, from any source (file, gmail,
// slack, github, drive): understand (categorize/entities/summary) -> embed
// (chunks tagged with category) -> Qdrant -> knowledge_documents + the map.
export async function ingestContentDoc(
  supabase: SupabaseServerClient,
  opts: { workspaceId: string; source: string; sourceRef: string; title: string; text: string; fileDbId?: string | null },
): Promise<number> {
  const { workspaceId, source, sourceRef, title, text } = opts;
  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  const synthesis = await synthesizeDocument(text, title);
  const vectors = await embedDocuments(chunks);
  // Qdrant key: files historically use the file id; others use source:ref.
  const qdrantKey = source === "file" ? sourceRef : `${source}:${sourceRef}`;

  await deleteFileChunks(workspaceId, qdrantKey);
  await upsertChunks(
    chunks.map((t, i) => ({ workspaceId, fileId: qdrantKey, chunkIndex: i, text: t, vector: vectors[i], category: synthesis.category, source })),
  );
  await supabase.from("knowledge_documents").upsert(
    {
      workspace_id: workspaceId,
      file_id: opts.fileDbId ?? null,
      source,
      source_ref: sourceRef,
      title: title || "(untitled)",
      status: "done",
      chunk_count: chunks.length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,source,source_ref" },
  );
  await persistUnderstanding(supabase, { workspaceId, source, sourceRef, synthesis });
  return chunks.length;
}

// Record a source's sync state (for the "last synced" UI + incremental cursor).
export async function recordSync(
  supabase: SupabaseServerClient,
  workspaceId: string,
  source: string,
  itemCount: number,
): Promise<void> {
  await supabase.from("knowledge_sources").upsert(
    { workspace_id: workspaceId, source, last_synced_at: new Date().toISOString(), item_count: itemCount },
    { onConflict: "workspace_id,source" },
  );
}

// Read the last successful sync time for a source (for incremental fetch).
export async function lastSyncedAt(
  supabase: SupabaseServerClient,
  workspaceId: string,
  source: string,
): Promise<Date | null> {
  const { data } = await supabase
    .from("knowledge_sources")
    .select("last_synced_at")
    .eq("workspace_id", workspaceId)
    .eq("source", source)
    .maybeSingle();
  return data?.last_synced_at ? new Date(data.last_synced_at) : null;
}
