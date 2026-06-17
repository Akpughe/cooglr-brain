// Composio action execution — the write-side counterpart to toolkit-ingest's
// read-side fetch adapters. Agent action tools (send email, create issue, post
// to Slack, …) run their real side-effects through here, keyed by the user's
// Composio connection. Mirrors the private `exec` helper in toolkit-ingest.

import { getComposio } from "./client";

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
