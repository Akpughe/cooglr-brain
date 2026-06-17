// Source reads for the agent's read tools. Query/id-driven counterparts to the
// time-windowed ingestion adapters in toolkit-ingest.ts, reusing the SAME proven
// Composio action slugs. Returns normalised, capped items the agent reasons over.
//
// Reads run against the acting user's own Composio connection (userId from the
// trusted RequestContext) and are connection-gated by the caller. They are not
// approval-gated — reading your own connected source is not an outward action.

import { execAction, unwrap } from "./actions";
import { gmailMessagesToDocs } from "./gmail-ingest";

export interface ReadItem {
  /** Stable id for the item (message/thread/issue/file). */
  id: string;
  title: string;
  text: string;
  /** Citation ref, e.g. "gmail:<id>" — surfaced as a Source chip. */
  ref: string;
}

// Caps to keep a big thread/channel from blowing the model's context.
const MAX_ITEMS = 10; // search / list results
const MAX_THREAD_MSGS = 20; // messages pulled from one thread/channel
const MAX_TEXT = 2000; // chars per item body

// --- defensive parsing (external shapes vary; mirrors toolkit-ingest) ---
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
function trim(s: string): string {
  return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + "…" : s;
}

// ---------- Gmail ----------
export async function gmailSearch(userId: string, query: string, max = MAX_ITEMS): Promise<ReadItem[]> {
  const res = await execAction("GMAIL_FETCH_EMAILS", userId, { query, max_results: max });
  return gmailMessagesToDocs(res)
    .slice(0, max)
    .map((d) => ({ id: d.id, title: d.subject || "(no subject)", text: trim(d.text), ref: `gmail:${d.id}` }));
}

// ⚠️ GMAIL_FETCH_MESSAGE_BY_THREAD_ID arg/result shape unverified — confirm live.
export async function gmailReadThread(userId: string, threadId: string, max = MAX_THREAD_MSGS): Promise<ReadItem[]> {
  const res = unwrap(await execAction("GMAIL_FETCH_MESSAGE_BY_THREAD_ID", userId, { thread_id: threadId }));
  const msgs = arrOf(res, ["messages", "results", "items"]);
  return msgs.slice(0, max).map((m, i) => {
    const id = pickStr(m, ["messageId", "id", "message_id"]) || `${threadId}-${i}`;
    const from = pickStr(m, ["sender", "from", "From"]);
    const subject = pickStr(m, ["subject", "Subject"]);
    const body = pickStr(m, ["messageText", "text", "body", "snippet"]);
    return {
      id,
      title: subject || `Message from ${from || "unknown"}`,
      text: trim(`${from ? `From: ${from}\n` : ""}${body}`),
      ref: `gmail:${threadId}`,
    };
  });
}

// ---------- Slack ----------
export async function slackListChannels(userId: string, max = MAX_ITEMS): Promise<ReadItem[]> {
  const res = unwrap(await execAction("SLACK_FIND_CHANNELS", userId, { limit: max, exclude_archived: true }));
  return arrOf(res, ["channels", "results", "items"]).slice(0, max).map((ch) => {
    const id = pickStr(ch, ["id", "channel_id", "channelId"]);
    const name = pickStr(ch, ["name"]) || id;
    return { id, title: `#${name}`, text: `Slack channel #${name}`, ref: `slack:${id}` };
  });
}

export async function slackReadChannel(userId: string, channel: string, max = MAX_THREAD_MSGS): Promise<ReadItem[]> {
  const res = unwrap(await execAction("SLACK_FETCH_CONVERSATION_HISTORY", userId, { channel, limit: max }));
  return arrOf(res, ["messages", "results", "items"]).slice(0, max).map((m, i) => {
    const id = pickStr(m, ["ts", "id"]) || `${channel}-${i}`;
    const user = pickStr(m, ["user", "username"]);
    const text = pickStr(m, ["text", "message"]);
    return { id, title: user ? `@${user}` : "message", text: trim(text), ref: `slack:${channel}` };
  });
}

// ---------- GitHub ----------
export async function githubListIssues(userId: string, owner: string, repo: string, max = MAX_ITEMS): Promise<ReadItem[]> {
  const res = unwrap(await execAction("GITHUB_LIST_REPOSITORY_ISSUES", userId, { owner, repo, per_page: max, state: "all" }));
  return arrOf(res, ["issues", "results", "items"]).slice(0, max).map((is) => {
    const num = (is as { number?: number }).number ?? "";
    const title = pickStr(is, ["title"]) || `Issue ${num}`;
    return { id: `${owner}/${repo}#${num}`, title: `#${num}: ${title}`, text: trim(pickStr(is, ["body"])), ref: `github:${owner}/${repo}#${num}` };
  });
}

// ---------- Google Drive ----------
export async function driveSearch(userId: string, query: string, max = MAX_ITEMS): Promise<ReadItem[]> {
  const args: Record<string, unknown> = { pageSize: max, orderBy: "modifiedTime desc" };
  if (query) args.q = `name contains '${query.replace(/'/g, "")}'`;
  const res = unwrap(await execAction("GOOGLEDRIVE_LIST_FILES", userId, args));
  return arrOf(res, ["files", "results", "items"]).slice(0, max).map((f) => {
    const id = pickStr(f, ["id", "fileId"]);
    const name = pickStr(f, ["name"]) || id;
    const mime = pickStr(f, ["mimeType", "mime_type"]);
    return { id, title: name, text: mime ? `Drive file (${mime})` : "Drive file", ref: `google-drive:${id}` };
  });
}

export async function driveReadFile(userId: string, fileId: string): Promise<ReadItem[]> {
  // Export Google-native docs to text; download others.
  let text = "";
  try {
    const ex = unwrap(await execAction("GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE", userId, { fileId, mimeType: "text/plain" }));
    text = pickStr(ex, ["text", "content", "data", "exportedContent"]);
  } catch {
    /* not a workspace file */
  }
  if (!text) {
    try {
      const dl = unwrap(await execAction("GOOGLEDRIVE_DOWNLOAD_FILE", userId, { fileId }));
      text = pickStr(dl, ["text", "content", "data"]);
    } catch {
      /* unreadable */
    }
  }
  return [{ id: fileId, title: `Drive file ${fileId}`, text: trim(text), ref: `google-drive:${fileId}` }];
}
