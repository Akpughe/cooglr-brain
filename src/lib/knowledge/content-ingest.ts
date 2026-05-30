import { chunkText } from "./chunk";
import { tiptapToText, extractViaNuton } from "./extract";
import { embedDocuments } from "./embeddings";
import { ensureCollection, upsertChunks, deleteFileChunks, type ChunkPoint } from "./qdrant";
import { synthesizeDocument, persistUnderstanding } from "./content-understanding";

import type { createClient } from "@/lib/supabase/server";
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const STORAGE_BUCKET = "file-uploads";
const TEXT_MIME = /^(text\/|application\/(json|xml|markdown))/;

export interface FileRow {
  id: string;
  type: "page" | "folder" | "file";
  title: string;
  content: unknown;
  storage_path: string | null;
  mime_type: string | null;
}

export interface IngestFileResult {
  fileId: string;
  title: string;
  chunks: number;
  skipped?: string;
}

// Resolve a file's plain text: TipTap pages parse directly; text uploads are read
// as-is; everything else (PDF/Office) goes through Nuton.
async function fileToText(
  supabase: SupabaseServerClient,
  file: FileRow,
  userId: string,
): Promise<string> {
  if (file.type === "page") return tiptapToText(file.content);
  if (file.type !== "file" || !file.storage_path) return "";

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(file.storage_path);
  if (error || !data) throw new Error(`download failed: ${error?.message ?? "no data"}`);

  if (file.mime_type && TEXT_MIME.test(file.mime_type)) {
    return await data.text();
  }
  return extractViaNuton([{ name: file.title, blob: data }], userId);
}

// Ingest one file into the vector corpus. Re-ingest is idempotent (deletes the
// file's old chunks first; deterministic point ids overwrite anyway).
export async function ingestFile(
  supabase: SupabaseServerClient,
  workspaceId: string,
  file: FileRow,
  userId: string,
): Promise<IngestFileResult> {
  const text = await fileToText(supabase, file, userId);
  const chunks = chunkText(text);
  if (chunks.length === 0) return { fileId: file.id, title: file.title, chunks: 0, skipped: "no text" };

  // Understand first so the category can tag every chunk (enables filtered dig).
  const synthesis = await synthesizeDocument(text, file.title);

  const vectors = await embedDocuments(chunks);
  const points: ChunkPoint[] = chunks.map((t, i) => ({
    workspaceId,
    fileId: file.id,
    chunkIndex: i,
    text: t,
    vector: vectors[i],
    category: synthesis.category,
    source: "file",
  }));

  await deleteFileChunks(workspaceId, file.id);
  await upsertChunks(points);

  await supabase.from("knowledge_documents").upsert(
    {
      workspace_id: workspaceId,
      file_id: file.id,
      source: "file",
      source_ref: file.id,
      title: file.title,
      status: "done",
      chunk_count: chunks.length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,source,source_ref" },
  );

  await persistUnderstanding(supabase, { workspaceId, source: "file", sourceRef: file.id, synthesis });

  return { fileId: file.id, title: file.title, chunks: chunks.length };
}

// Ingest all ingestible files (pages + uploads) in a workspace.
export async function ingestWorkspaceContent(
  supabase: SupabaseServerClient,
  workspaceId: string,
  userId: string,
): Promise<IngestFileResult[]> {
  await ensureCollection();

  const { data: files } = await supabase
    .from("files")
    .select("id, type, title, content, storage_path, mime_type")
    .eq("workspace_id", workspaceId)
    .in("type", ["page", "file"]);

  const results: IngestFileResult[] = [];
  for (const f of (files ?? []) as FileRow[]) {
    try {
      results.push(await ingestFile(supabase, workspaceId, f, userId));
    } catch (err) {
      results.push({ fileId: f.id, title: f.title, chunks: 0, skipped: err instanceof Error ? err.message : "error" });
    }
  }
  return results;
}
