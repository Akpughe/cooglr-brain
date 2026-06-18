// Source reads for the agent's read tools. Query/id-driven counterparts to the
// time-windowed ingestion adapters in toolkit-ingest.ts, reusing the SAME proven
// Composio action slugs. Returns normalised, capped items the agent reasons over.
//
// Reads run against the acting user's own Composio connection (userId from the
// trusted RequestContext) and are connection-gated by the caller. They are not
// approval-gated — reading your own connected source is not an outward action.

import { execAction, unwrap } from "./actions";

export interface ReadItem {
  /** Stable id for the item (message/thread/issue/file). */
  id: string;
  title: string;
  text: string;
  /** Citation ref, e.g. "gmail:<id>" — surfaced as a Source chip. */
  ref: string;
}

// Caps to keep a big thread/channel from blowing the model's context.
const MAX_ITEMS = 10; // generic search / list results (slack/github/drive)
const MAX_THREAD_MSGS = 20; // messages pulled from one thread/channel
const MAX_TEXT = 2000; // chars per item body (thread/file reads)

// Gmail search is the coverage tool — it paginates through ALL matches up to a
// real ceiling and returns lightweight metadata (sender/recipient/date/snippet)
// so the agent can thoroughly enumerate people/threads without blowing context.
const GMAIL_PAGE = 50; // results per Composio page
const GMAIL_SEARCH_MAX = 120; // total search results across pages
const SNIPPET = 200; // chars of preview per search result

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
// Paginate GMAIL_FETCH_EMAILS until exhausted or the ceiling, returning a
// lightweight item per message (subject + from/to/date + short snippet) so the
// agent sees the FULL set of matches, not just the first page. No date filter —
// searches the whole mailbox; `query` is Gmail search syntax from the agent.
export async function gmailSearch(userId: string, query: string, max = GMAIL_SEARCH_MAX): Promise<ReadItem[]> {
  const items: ReadItem[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 6 && items.length < max; page++) {
    const args: Record<string, unknown> = { query, max_results: Math.min(GMAIL_PAGE, max - items.length) };
    if (pageToken) args.page_token = pageToken;
    const root = unwrap(await execAction("GMAIL_FETCH_EMAILS", userId, args));
    const msgs = arrOf(root, ["messages", "emails", "items", "results"]);
    for (const m of msgs) {
      const id =
        pickStr(m, ["messageId", "id", "message_id"]) ||
        pickStr(m, ["threadId", "thread_id"]) ||
        String(items.length);
      const subject = pickStr(m, ["subject", "Subject"]) || "(no subject)";
      const from = pickStr(m, ["sender", "from", "From"]);
      const to = pickStr(m, ["to", "To", "recipient", "recipients"]);
      const date = pickStr(m, ["date", "Date", "messageTimestamp", "internalDate"]);
      const snippet = pickStr(m, ["snippet", "preview", "messageText", "message_text", "body", "text"]).slice(0, SNIPPET);
      const meta = [from && `From: ${from}`, to && `To: ${to}`, date && `Date: ${date}`].filter(Boolean).join(" · ");
      items.push({ id, title: subject, text: meta ? `${meta}\n${snippet}` : snippet, ref: `gmail:${id}` });
      if (items.length >= max) break;
    }
    pageToken = pickStr(root, ["nextPageToken", "next_page_token", "pageToken", "page_token"]) || undefined;
    if (!pageToken || msgs.length === 0) break;
  }
  return items;
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
  // Strip quotes and backslashes so the value can't break out of the quoted
  // literal (read-only on the user's own Drive; a bad query just fails safely).
  if (query) args.q = `name contains '${query.replace(/['\\]/g, "")}'`;
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
