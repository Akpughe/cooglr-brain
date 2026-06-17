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
};

const KEYS: (keyof AgentRequestContext)[] = [
  "userId",
  "workspaceId",
  "workspaceSlug",
  "role",
  "traceId",
];

// Build a Mastra RequestContext from trusted values.
export function buildRequestContext(values: AgentRequestContext): RequestContext {
  return new RequestContext(KEYS.map((key) => [key, values[key]] as const));
}

// Read the trusted context back out inside a tool's execute. Throws if any key
// is missing — tools must never silently fall back to model-supplied ids.
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
  return out;
}
