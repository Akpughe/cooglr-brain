// Server-only typed client for the UltraMem memory service.
// Reads ULTRAMEM_API_URL / ULTRAMEM_API_KEY from the environment at call time,
// so it must only run in a server runtime — never import this from client code.
// The HTTP contract here matches what the service ACTUALLY implements (its own
// docs overstate it): note the mixed camelCase (search) / snake_case (timeline)
// response shapes, which this module normalizes into clean typed objects.

// ---------------------------------------------------------------------------
// Env (read lazily so server runtimes that inject vars late still work)
// ---------------------------------------------------------------------------

/** Base URL with trailing slashes stripped; defaults to localhost:8080. */
function baseUrl(): string {
  const raw = process.env.ULTRAMEM_API_URL || "http://localhost:8080";
  return raw.replace(/\/+$/, "");
}

/** API key, or undefined when unset (auth header is then omitted). */
function apiKey(): string | undefined {
  return process.env.ULTRAMEM_API_KEY || undefined;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UltraMemHealth {
  ok: boolean;
}

export interface AddMemoryInput {
  content?: string;
  url?: string;
  filePath?: string;
  title?: string;
  source?: string;
  reference?: string;
  containerTag?: string;
  /** Epoch ms (or whatever unit the server expects) the memory was captured. */
  capturedAt?: number;
}

export interface AddMemoryResult {
  documentId: string;
  status: string;
}

export interface SearchInput {
  query: string;
  containerTag?: string;
  /** Defaults to 8, clamped to 1–50. */
  limit?: number;
}

/** A normalized search hit (server returns camelCase doc fields). */
export interface UltraMemDocument {
  id: string;
  title?: string;
  source?: string;
  reference?: string;
  capturedAt?: number;
  snippets: string[];
}

export interface UltraMemSearchResult {
  documents: UltraMemDocument[];
  memories: string[];
}

export interface UltraMemProfile {
  static: string;
  dynamic: string;
}

/** A normalized timeline entry (server returns snake_case fields here). */
export interface UltraMemTimelineItem {
  documentId: string;
  title?: string;
  source?: string;
  reference?: string;
  capturedAt?: number;
}

export interface TimelineInput {
  containerTag?: string;
  /** Pagination cursor: only items captured before this epoch value. */
  before?: number;
  /** Defaults to 60, clamped to 1–500. */
  limit?: number;
}

export interface TimelineResult {
  items: UltraMemTimelineItem[];
}

export type ReindexMode = "tags" | "latest" | "facts";

export interface ReindexInput {
  containerTag?: string;
  mode?: ReindexMode;
}

export interface ReindexResult {
  ok: boolean;
  mode: string;
}

// ---------------------------------------------------------------------------
// Low-level request helper
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 3_000;

interface RequestOptions {
  method?: string;
  /** JSON body (POST). */
  body?: unknown;
  /** Query params appended to the path. */
  query?: Record<string, string | number | undefined>;
  /** Skip the Authorization header (used for /v1/health). */
  noAuth?: boolean;
  timeoutMs?: number;
}

/** Issue a request to UltraMem, parse JSON, and throw on any non-2xx. */
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, noAuth, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  let url = `${baseUrl()}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const key = apiKey();
  if (!noAuth && key) headers["Authorization"] = `Bearer ${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`UltraMem ${method} ${path} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Clamp `value` (or `fallback` when undefined) into the inclusive [min, max]. */
function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = value ?? fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

// ---------------------------------------------------------------------------
// Raw wire shapes (kept private; normalized into the public types above)
// ---------------------------------------------------------------------------

interface RawSearchDocument {
  documentId: string;
  title?: string;
  metadata?: { capturedAt?: number; source?: string; reference?: string };
  chunks?: Array<{ content: string }>;
}

interface RawSearchResult {
  documents?: RawSearchDocument[];
  memories?: string[];
}

interface RawTimelineItem {
  document_id: string;
  title?: string;
  source?: string;
  reference?: string;
  captured_at?: number;
}

interface RawTimelineResult {
  items?: RawTimelineItem[];
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const ultramem = {
  /** Liveness probe (unauthenticated, short timeout). */
  async health(): Promise<UltraMemHealth> {
    return request<UltraMemHealth>("/v1/health", { noAuth: true, timeoutMs: HEALTH_TIMEOUT_MS });
  },

  /** Store a memory. Pass at most the fields you have; the server fills the rest. */
  async addMemory(input: AddMemoryInput): Promise<AddMemoryResult> {
    // The server replies snake_case ({ document_id, status }); normalize it.
    const raw = await request<{ document_id?: string; documentId?: string; status?: string }>(
      "/v1/memories",
      {
        method: "POST",
        body: {
          content: input.content,
          url: input.url,
          file_path: input.filePath,
          title: input.title,
          source: input.source,
          reference: input.reference,
          container_tag: input.containerTag,
          captured_at: input.capturedAt,
        },
      },
    );
    return { documentId: raw.document_id ?? raw.documentId ?? "", status: raw.status ?? "" };
  },

  /** Delete a memory by document id. */
  async deleteMemory(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/v1/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /** Semantic search within a container; normalizes camelCase docs into snippets. */
  async search({ query, containerTag, limit }: SearchInput): Promise<UltraMemSearchResult> {
    const raw = await request<RawSearchResult>("/v1/search", {
      method: "POST",
      body: {
        query,
        container_tag: containerTag,
        limit: clamp(limit, 8, 1, 50),
      },
    });
    return {
      documents: (raw.documents ?? []).map((d) => ({
        id: d.documentId,
        title: d.title,
        source: d.metadata?.source,
        reference: d.metadata?.reference,
        capturedAt: d.metadata?.capturedAt,
        snippets: (d.chunks ?? []).map((c) => c.content),
      })),
      memories: raw.memories ?? [],
    };
  },

  /** Fetch the static + dynamic profile sections for one container. */
  async profile(containerTag?: string): Promise<UltraMemProfile> {
    return request<UltraMemProfile>("/v1/profile", {
      query: { container_tag: containerTag },
    });
  },

  /** Reverse-chronological document feed for a container; normalizes snake_case. */
  async timeline({ containerTag, before, limit }: TimelineInput): Promise<TimelineResult> {
    const raw = await request<RawTimelineResult>("/v1/timeline", {
      query: {
        container_tag: containerTag,
        before,
        limit: clamp(limit, 60, 1, 500),
      },
    });
    return {
      items: (raw.items ?? []).map((i) => ({
        documentId: i.document_id,
        title: i.title,
        source: i.source,
        reference: i.reference,
        capturedAt: i.captured_at,
      })),
    };
  },

  /** Trigger a reindex of a container (tags / latest / facts). */
  async reindex({ containerTag, mode }: ReindexInput = {}): Promise<ReindexResult> {
    return request<ReindexResult>("/v1/reindex", {
      method: "POST",
      body: { container_tag: containerTag, mode },
    });
  },
};

// ---------------------------------------------------------------------------
// Multi-scope helper
// ---------------------------------------------------------------------------

/**
 * Build a single prompt-ready profile string by fetching each container's
 * profile and concatenating the labeled static + dynamic sections. The server
 * has no multi-tag profile endpoint, so this fans out one call per tag.
 * Resilient by design: a tag that 404s or errors is skipped, not fatal.
 */
export async function composeProfile(containerTags: string[]): Promise<string> {
  const sections = await Promise.all(
    containerTags.map(async (tag) => {
      try {
        const p = await ultramem.profile(tag);
        const parts: string[] = [];
        if (p.static?.trim()) parts.push(`Static:\n${p.static.trim()}`);
        if (p.dynamic?.trim()) parts.push(`Dynamic:\n${p.dynamic.trim()}`);
        if (parts.length === 0) return null;
        return `## ${tag}\n${parts.join("\n\n")}`;
      } catch {
        return null;
      }
    }),
  );
  return sections.filter((s): s is string => s !== null).join("\n\n");
}
