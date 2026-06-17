// Write workspace content into UltraMem — the memory + retrieval foundation.
// container_tags are ALWAYS built server-side via scopes.ts (never from the model
// or client). UltraMem chunks/embeds server-side, so we pass the full text.

import { ultramem } from "./ultramem-client";
import { scopes } from "./scopes";

export interface MemoryIngestInput {
  workspaceId: string;
  /** Stable id of the source record (file id, message id, …) for citations. */
  reference: string;
  title: string;
  text: string;
  /** Origin label: "file" | "github" | "gmail" | "slack" | "google-drive" | … */
  source?: string;
  /** Epoch seconds the content was captured/updated. */
  capturedAt?: number;
}

/** Store one document's text in the workspace's memory. Best-effort: callers
 *  should not fail their primary flow if this throws. */
export async function ingestToMemory(input: MemoryIngestInput): Promise<string | null> {
  const text = input.text?.trim();
  if (!text) return null;
  const res = await ultramem.addMemory({
    content: text,
    title: input.title,
    source: input.source ?? "file",
    reference: input.reference,
    containerTag: scopes.workspace(input.workspaceId),
    capturedAt: input.capturedAt,
  });
  return res.documentId;
}
