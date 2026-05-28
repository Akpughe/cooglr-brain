// Text extraction for content ingestion.
// - TipTap pages: parse the stored JSON directly (pure, no network).
// - PDF/Office uploads: Nuton /v2/documents/extract.
// - Plain text/markdown: passthrough.

// A TipTap/ProseMirror node tree.
interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

const BLOCK_TYPES = new Set([
  "paragraph", "heading", "listItem", "blockquote", "codeBlock",
  "tableRow", "tableCell", "tableHeader",
]);

// Recursively collect text, inserting newlines after block nodes so the result
// reads as prose rather than one run-on line.
export function tiptapToText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (node: TiptapNode) => {
    if (typeof node.text === "string") parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
    if (node.type && BLOCK_TYPES.has(node.type)) parts.push("\n");
  };
  if (doc && typeof doc === "object") walk(doc as TiptapNode);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

// Extract text from binary documents (PDF/Office) via Nuton. `files` are the
// uploaded bytes; `userId` scopes the Nuton call (their X-External-User-Id).
export async function extractViaNuton(
  files: { name: string; blob: Blob }[],
  userId: string,
): Promise<string> {
  const key = process.env.NUTON_KEY;
  if (!key) throw new Error("NUTON_KEY not configured");
  const form = new FormData();
  for (const f of files) form.append("files", f.blob, f.name);

  const res = await fetch("https://api.nuton.app/v2/documents/extract", {
    method: "POST",
    headers: { "X-API-Key": key, "X-External-User-Id": userId },
    body: form,
  });
  if (!res.ok) throw new Error(`Nuton error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: unknown = await res.json();
  return nutonText(data);
}

// Defensive parse of Nuton's response into a single text blob. The API shape may
// evolve; pull text from the common fields (documents[].text / .content / .markdown).
export function nutonText(data: unknown): string {
  const collect: string[] = [];
  const pick = (o: Record<string, unknown>) => {
    for (const k of ["text", "content", "markdown", "extracted_text"]) {
      if (typeof o[k] === "string") { collect.push(o[k] as string); return; }
    }
  };
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      pick(v as Record<string, unknown>);
      for (const val of Object.values(v as Record<string, unknown>)) {
        if (Array.isArray(val) || (val && typeof val === "object")) visit(val);
      }
    }
  };
  visit(data);
  return collect.join("\n\n").trim();
}
