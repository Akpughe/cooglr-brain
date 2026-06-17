// Client helper: turn a workspace file id into an OpenDocument the side viewer
// can render. Images/PDFs preview from their public URL; text/markdown fetch
// their content; anything else falls back to an "Open original" card.

import type { OpenDocument } from "@/components/agent-shell/agent-document-viewer";

type ApiFile = {
  id: string;
  type: string;
  title: string;
  content?: unknown;
  mimeType?: string | null;
  url?: string | null;
};

function extOf(title: string): string {
  const dot = title.lastIndexOf(".");
  return dot > 0 ? title.slice(dot + 1).toLowerCase() : "";
}

function previewKind(mime: string | null | undefined, title: string): OpenDocument["kind"] {
  const ext = extOf(title);
  if ((mime && mime.startsWith("image/")) || ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (ext === "csv" || (mime?.includes("csv") ?? false)) return "csv";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (
    (mime && (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml"))) ||
    ["txt", "json", "xml", "log", "yml", "yaml"].includes(ext)
  ) {
    return "text";
  }
  return "report"; // docx/xlsx/pptx/etc → open-original fallback
}

/** Coerce a plain numeric string to a number so the table right-aligns it;
 *  leave dates/times/ids (which contain - or :) as strings. */
function toCell(v: string): string | number {
  const t = v.trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : v;
}

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes ("")
 *  and commas/newlines inside quotes. Returns null if there's no usable header. */
function parseCsv(text: string): { columns: string[]; rows: (string | number)[][] } | null {
  const grid: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); grid.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) endRow();

  const clean = grid.filter((r) => r.some((c) => c.trim() !== ""));
  if (clean.length === 0) return null;
  const columns = clean[0];
  const MAX_ROWS = 2000;
  const rows = clean.slice(1, 1 + MAX_ROWS).map((r) => {
    const cells = r.slice(0, columns.length);
    while (cells.length < columns.length) cells.push("");
    return cells.map(toCell);
  });
  return { columns, rows };
}

/** A placeholder document shown immediately while the real preview loads. */
export function loadingDocFor(title: string): OpenDocument {
  return { title, breadcrumb: ["Files", title], kind: "report", loading: true };
}

export async function buildFilePreview(fileId: string, title: string): Promise<OpenDocument> {
  const breadcrumb = ["Files", title];
  let file: ApiFile | undefined;
  try {
    const res = await fetch(`/api/files/${fileId}`);
    if (res.ok) file = (await res.json())?.file as ApiFile | undefined;
  } catch {
    /* network error — handled below */
  }
  if (!file) {
    return { title, breadcrumb, kind: "report", contentMd: `# ${title}\n\nCouldn't load this file.` };
  }

  const url = file.url ?? undefined;
  const kind = previewKind(file.mimeType, title);
  const base: OpenDocument = { title, breadcrumb, kind, sourceUrl: url };

  if (kind === "image") return { ...base, imageUrl: url };
  if (kind === "pdf") return base; // rendered via <iframe src=sourceUrl>

  if (kind === "csv") {
    let text = typeof file.content === "string" ? file.content : "";
    if (!text && url) {
      try {
        text = await fetch(url).then((r) => (r.ok ? r.text() : ""));
      } catch {
        /* fall through */
      }
    }
    const parsed = text ? parseCsv(text) : null;
    if (parsed) {
      return { ...base, table: { columns: parsed.columns, rows: parsed.rows, filename: title } };
    }
    // Couldn't parse → show the raw text rather than nothing.
    if (text) return { ...base, kind: "text", contentMd: text };
    return base;
  }

  if (kind === "text" || kind === "markdown") {
    if (typeof file.content === "string" && file.content.trim()) {
      return { ...base, contentMd: file.content };
    }
    if (url) {
      try {
        const text = await fetch(url).then((r) => (r.ok ? r.text() : ""));
        if (text) return { ...base, contentMd: text };
      } catch {
        /* fall through to open-original */
      }
    }
  }

  // Unknown / unfetchable: keep sourceUrl so the viewer offers "Open original".
  if (url) return base;
  return { ...base, contentMd: `# ${title}\n\nNo preview is available for this file.` };
}
