import { getComposio } from "./client";
import { gmailMessagesToDocs } from "./gmail-ingest";
import { ingestContentDoc, recordSync, lastSyncedAt } from "@/lib/knowledge/ingest-doc";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface SourceDoc {
  id: string;
  title: string;
  text: string;
}

// --- defensive helpers (external result shapes vary) ---
function dataOf(r: unknown): unknown {
  return (r as { data?: unknown })?.data ?? r;
}
function arrOf(root: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(root)) return root as Record<string, unknown>[];
  if (root && typeof root === "object") {
    const o = root as Record<string, unknown>;
    for (const k of keys) if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  }
  return [];
}
function pickStr(o: unknown, keys: string[]): string {
  if (!o || typeof o !== "object") return "";
  const r = o as Record<string, unknown>;
  for (const k of keys) if (typeof r[k] === "string" && r[k]) return r[k] as string;
  return "";
}
function gmailDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
async function exec(slug: string, userId: string, args: Record<string, unknown>): Promise<unknown> {
  return getComposio().tools.execute(slug, { userId, arguments: args, dangerouslySkipVersionCheck: true });
}

// --- per-toolkit fetch adapters ---

async function fetchGmail(userId: string, since: Date | null, max: number): Promise<SourceDoc[]> {
  const args: Record<string, unknown> = { max_results: max };
  if (since) args.query = `after:${gmailDate(since)}`; // incremental: only newer mail
  const res = await exec("GMAIL_FETCH_EMAILS", userId, args);
  return gmailMessagesToDocs(res).map((d) => ({ id: d.id, title: d.subject, text: d.text }));
}

async function fetchSlack(userId: string, since: Date | null, max: number): Promise<SourceDoc[]> {
  const chRes = await exec("SLACK_FIND_CHANNELS", userId, { limit: 10, exclude_archived: true });
  const channels = arrOf(dataOf(chRes), ["channels", "results", "items"]);
  const oldest = since ? String(Math.floor(since.getTime() / 1000)) : undefined;
  const docs: SourceDoc[] = [];
  for (const ch of channels.slice(0, 10)) {
    const cid = pickStr(ch, ["id", "channel_id", "channelId"]);
    const cname = pickStr(ch, ["name"]) || cid;
    if (!cid) continue;
    const hRes = await exec("SLACK_FETCH_CONVERSATION_HISTORY", userId, { channel: cid, limit: 50, ...(oldest ? { oldest } : {}) });
    const msgs = arrOf(dataOf(hRes), ["messages", "results", "items"]);
    const text = msgs.map((m) => pickStr(m, ["text", "message"])).filter(Boolean).join("\n");
    if (text.trim()) docs.push({ id: cid, title: `#${cname}`, text: `Slack channel #${cname}\n\n${text}` });
    if (docs.length >= max) break;
  }
  return docs;
}

async function fetchDrive(userId: string, since: Date | null, max: number): Promise<SourceDoc[]> {
  const args: Record<string, unknown> = { pageSize: Math.min(max, 100), orderBy: "modifiedTime desc" };
  if (since) args.q = `modifiedTime > '${since.toISOString()}'`;
  const listRes = await exec("GOOGLEDRIVE_LIST_FILES", userId, args);
  const files = arrOf(dataOf(listRes), ["files", "results", "items"]);
  const docs: SourceDoc[] = [];
  for (const f of files.slice(0, max)) {
    const fid = pickStr(f, ["id", "fileId"]);
    const name = pickStr(f, ["name"]) || fid;
    const mime = pickStr(f, ["mimeType", "mime_type"]);
    if (!fid) continue;
    let text = "";
    try {
      if (mime.startsWith("application/vnd.google-apps")) {
        const ex = dataOf(await exec("GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE", userId, { fileId: fid, mimeType: "text/plain" }));
        text = pickStr(ex, ["text", "content", "data", "exportedContent"]);
      } else {
        const dl = dataOf(await exec("GOOGLEDRIVE_DOWNLOAD_FILE", userId, { fileId: fid }));
        text = pickStr(dl, ["text", "content", "data"]);
      }
    } catch { /* skip files we can't read */ }
    if (text.trim()) docs.push({ id: fid, title: name, text });
  }
  return docs;
}

// Best-effort; slugs/args may need a tweak after a live connect.
async function fetchGithub(userId: string, _since: Date | null, max: number): Promise<SourceDoc[]> {
  const docs: SourceDoc[] = [];
  try {
    const repoRes = await exec("GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", userId, { per_page: 10 });
    const repos = arrOf(dataOf(repoRes), ["repositories", "results", "items"]);
    for (const r of repos.slice(0, 5)) {
      const owner = pickStr(r.owner as Record<string, unknown> | undefined ?? {}, ["login"]) || pickStr(r, ["owner"]);
      const name = pickStr(r, ["name"]);
      if (!owner || !name) continue;
      try {
        const issRes = await exec("GITHUB_LIST_REPOSITORY_ISSUES", userId, { owner, repo: name, per_page: 20, state: "all" });
        for (const is of arrOf(dataOf(issRes), ["issues", "results", "items"])) {
          const title = pickStr(is, ["title"]);
          if (!title) continue;
          const num = (is as { number?: number }).number ?? "";
          docs.push({ id: `${owner}/${name}#${num}`, title: `${name}#${num}: ${title}`, text: `${title}\n\n${pickStr(is, ["body"])}` });
          if (docs.length >= max) return docs;
        }
      } catch { /* skip repo */ }
    }
  } catch { /* adapter unavailable */ }
  return docs;
}

const ADAPTERS: Record<string, (userId: string, since: Date | null, max: number) => Promise<SourceDoc[]>> = {
  gmail: fetchGmail,
  slack: fetchSlack,
  "google-drive": fetchDrive,
  github: fetchGithub,
};

export const INGESTABLE_TOOLKITS = Object.keys(ADAPTERS);

// Unified ingest: fetch (incrementally, since last sync) -> understand+embed each
// doc -> record sync state. Works for gmail/slack/github/google-drive.
export async function ingestToolkit(
  supabase: SupabaseServerClient,
  opts: { workspaceId: string; userId: string; toolkit: string; max?: number },
): Promise<{ items: number; chunks: number }> {
  const adapter = ADAPTERS[opts.toolkit];
  if (!adapter) throw new Error(`No ingest adapter for ${opts.toolkit}`);
  const { workspaceId, userId, toolkit, max = 50 } = opts;

  const since = await lastSyncedAt(supabase, workspaceId, toolkit);
  const docs = await adapter(userId, since, max);

  let chunks = 0;
  for (const d of docs) {
    chunks += await ingestContentDoc(supabase, { workspaceId, source: toolkit, sourceRef: d.id, title: d.title, text: d.text });
  }

  // Store total understood docs for this source as the displayed item count.
  const { count } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("source", toolkit);
  await recordSync(supabase, workspaceId, toolkit, count ?? docs.length);

  return { items: docs.length, chunks };
}
