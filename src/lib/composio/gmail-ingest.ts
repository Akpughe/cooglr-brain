import { getComposio } from "./client";
import { chunkText } from "@/lib/knowledge/chunk";
import { embedDocuments } from "@/lib/knowledge/embeddings";
import { ensureCollection, upsertChunks, deleteFileChunks } from "@/lib/knowledge/qdrant";
import { synthesizeDocument, persistUnderstanding } from "@/lib/knowledge/content-understanding";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface GmailDoc {
  id: string;
  text: string;
  subject: string;
}

// Start the Gmail OAuth connection for a user. Returns the hosted redirect URL.
export async function startGmailConnection(userId: string): Promise<{ redirectUrl: string; connectionId: string }> {
  const authConfigId = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID;
  if (!authConfigId) throw new Error("COMPOSIO_GMAIL_AUTH_CONFIG_ID not configured");
  const conn = await getComposio().connectedAccounts.link(userId, authConfigId);
  if (!conn.redirectUrl) throw new Error("Composio did not return a redirect URL");
  return { redirectUrl: conn.redirectUrl, connectionId: conn.id };
}

// Pure: turn a GMAIL_FETCH_EMAILS result into {id, subject, text} docs.
// Defensive about shape — pulls the message array and the common text fields.
export function gmailMessagesToDocs(result: unknown): GmailDoc[] {
  const root = (result as { data?: unknown })?.data ?? result;
  // Find the messages array (data.messages, data.emails, or data itself).
  let arr: unknown[] = [];
  if (Array.isArray(root)) arr = root;
  else if (root && typeof root === "object") {
    const o = root as Record<string, unknown>;
    for (const k of ["messages", "emails", "items", "results"]) {
      if (Array.isArray(o[k])) { arr = o[k] as unknown[]; break; }
    }
  }

  const pick = (o: Record<string, unknown>, keys: string[]): string => {
    for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
    return "";
  };

  const docs: GmailDoc[] = [];
  for (const m of arr) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const id = pick(o, ["messageId", "id", "message_id", "threadId", "thread_id"]) || String(docs.length);
    const subject = pick(o, ["subject", "Subject"]);
    const sender = pick(o, ["sender", "from", "From"]);
    const body = pick(o, ["messageText", "message_text", "body", "text", "snippet", "preview", "messageBody"]);
    const text = [subject && `Subject: ${subject}`, sender && `From: ${sender}`, body].filter(Boolean).join("\n");
    if (text.trim()) docs.push({ id, subject, text });
  }
  return docs;
}

// Fetch the user's recent Gmail messages via Composio and ingest into the RAG
// corpus (same pipeline as Files content). Tracked in knowledge_documents with
// source='gmail'.
export async function ingestGmail(
  supabase: SupabaseServerClient,
  opts: { workspaceId: string; userId: string; max?: number },
): Promise<{ messages: number; chunks: number }> {
  const { workspaceId, userId, max = 50 } = opts;
  const result = await getComposio().tools.execute("GMAIL_FETCH_EMAILS", {
    userId,
    arguments: { max_results: max },
    // Use the latest deployed toolkit version (Composio requires an explicit
    // version for manual execution otherwise). Pin via toolkitVersions later.
    dangerouslySkipVersionCheck: true,
  });
  const docs = gmailMessagesToDocs(result);
  if (docs.length === 0) return { messages: 0, chunks: 0 };

  await ensureCollection();
  let totalChunks = 0;

  for (const doc of docs) {
    const chunks = chunkText(doc.text);
    if (chunks.length === 0) continue;

    // Understand first so the category tags every chunk (enables filtered dig).
    const synthesis = await synthesizeDocument(doc.text, doc.subject);

    const vectors = await embedDocuments(chunks);
    const fileRef = `gmail:${doc.id}`;
    await deleteFileChunks(workspaceId, fileRef);
    await upsertChunks(
      chunks.map((t, i) => ({ workspaceId, fileId: fileRef, chunkIndex: i, text: t, vector: vectors[i], category: synthesis.category })),
    );
    await supabase.from("knowledge_documents").upsert(
      {
        workspace_id: workspaceId,
        file_id: null,
        source: "gmail",
        source_ref: doc.id,
        title: doc.subject || "(no subject)",
        status: "done",
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,source,source_ref" },
    );

    await persistUnderstanding(supabase, { workspaceId, source: "gmail", sourceRef: doc.id, synthesis });

    totalChunks += chunks.length;
  }

  return { messages: docs.length, chunks: totalChunks };
}
