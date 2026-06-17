// Composio action execution — the write-side counterpart to toolkit-ingest's
// read-side fetch adapters. Agent action tools (send email, create issue, post
// to Slack, …) run their real side-effects through here, keyed by the user's
// Composio connection. Mirrors the private `exec` helper in toolkit-ingest.

import { getComposio } from "./client";
import { listConnectedToolkits } from "./connect";

/** Execute a Composio tool action for a user. `slug` is the Composio action id
 *  (e.g. "GMAIL_SEND_EMAIL"); `userId` must have an active connection for the
 *  action's toolkit. Throws if Composio isn't configured or the call fails. */
export async function execAction(
  slug: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return getComposio().tools.execute(slug, {
    userId,
    arguments: args,
    dangerouslySkipVersionCheck: true,
  });
}

/** External result shapes vary; unwrap a `{ data }` envelope when present. */
export function unwrap(r: unknown): unknown {
  return (r as { data?: unknown })?.data ?? r;
}

// Short per-user cache so connection lookups don't tax every agent turn.
const connCache = new Map<string, { at: number; toolkits: string[] }>();
const CONN_TTL_MS = 60_000;

/** The user's connected toolkits, with a 60s cache and a dev override.
 *  AGENT_FAKE_CONNECTED (non-production only) forces the list so the full
 *  agent→approval→execute loop is testable without a real Composio connection.
 *  Best-effort: returns the last cached value (or []) if Composio errors. */
export async function resolveConnectedToolkits(userId: string): Promise<string[]> {
  const fake = process.env.AGENT_FAKE_CONNECTED;
  if (fake && process.env.NODE_ENV !== "production") {
    return fake.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  const hit = connCache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < CONN_TTL_MS) return hit.toolkits;
  try {
    const toolkits = await listConnectedToolkits(userId);
    connCache.set(userId, { at: now, toolkits });
    return toolkits;
  } catch {
    return hit?.toolkits ?? [];
  }
}
