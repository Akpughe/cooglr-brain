// Per-request context carried into the agent run and read by tools.
//
// The workspace/user identity is established by the trusted API layer (auth +
// membership check) and injected here. Tools MUST read identity from this
// context — never from model-provided arguments — so the model can't reach
// into another workspace's data.

import { RequestContext } from "@mastra/core/request-context";

export type AgentRequestContext = {
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  role: string;
  traceId: string;
  /** Document ids the user explicitly @-referenced — retrieval is hard-pinned to
   *  these when present. Established server-side from validated file ids, never
   *  from model-supplied arguments. Empty/absent = whole-workspace search. */
  focusFileIds?: string[];
};

// Required string keys (every run must carry these).
type StringKey = "userId" | "workspaceId" | "workspaceSlug" | "role" | "traceId";
const KEYS: StringKey[] = [
  "userId",
  "workspaceId",
  "workspaceSlug",
  "role",
  "traceId",
];

const FOCUS_KEY = "focusFileIds";

// Build a Mastra RequestContext from trusted values.
export function buildRequestContext(values: AgentRequestContext): RequestContext {
  const entries = KEYS.map((key) => [key, values[key]] as [string, string]);
  if (values.focusFileIds && values.focusFileIds.length > 0) {
    entries.push([FOCUS_KEY, JSON.stringify(values.focusFileIds)]);
  }
  return new RequestContext(entries);
}

// Read the trusted context back out inside a tool's execute. Throws if any
// required key is missing — tools must never silently fall back to model-supplied
// ids. focusFileIds is optional and parsed back into a string array.
export function readContext(context: {
  requestContext?: RequestContext;
}): AgentRequestContext {
  const rc = context.requestContext;
  if (!rc) {
    throw new Error("Agent tool invoked without a RequestContext");
  }
  const out = {} as AgentRequestContext;
  for (const key of KEYS) {
    const value = rc.get(key) as string | undefined;
    if (!value) {
      throw new Error(`Missing "${key}" in agent RequestContext`);
    }
    out[key] = value;
  }
  const focusRaw = rc.get(FOCUS_KEY) as string | undefined;
  if (focusRaw) {
    try {
      const parsed = JSON.parse(focusRaw);
      if (Array.isArray(parsed)) out.focusFileIds = parsed.filter((x) => typeof x === "string");
    } catch {
      /* ignore malformed focus list */
    }
  }
  return out;
}
