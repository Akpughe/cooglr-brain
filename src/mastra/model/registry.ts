// Model registry for the agent runtime.
//
// Mirrors src/lib/knowledge/llm.ts resolveModel: a Fireworks account path
// (e.g. "accounts/fireworks/models/kimi-k2p5") uses the Fireworks provider
// directly via FIREWORKS_API_KEY; any other "provider/model" string is passed
// through as-is, which routes via the Vercel AI Gateway (AI_GATEWAY).

import { fireworks } from "@ai-sdk/fireworks";
import { groq } from "@ai-sdk/groq";

export type ModelProfile = "auto" | "fast" | "deep";

// Profile -> concrete model id. Currently all profiles run gpt-oss-120b on Groq.
// "groq/<model>" uses the Groq provider (GROQ_API_KEY); "accounts/fireworks/..."
// uses Fireworks; anything else routes via the Vercel AI Gateway.
export const MODEL_PROFILES: Record<ModelProfile, string> = {
  fast: "groq/openai/gpt-oss-120b",
  deep: "groq/openai/gpt-oss-120b",
  auto: "groq/openai/gpt-oss-120b",
};

function isProfile(value: string): value is ModelProfile {
  return value === "auto" || value === "fast" || value === "deep";
}

// Resolve a profile name OR a raw model id to an AI SDK model instance/string.
export function resolveModel(profileOrId: string) {
  const id = isProfile(profileOrId) ? MODEL_PROFILES[profileOrId] : profileOrId;
  if (id.startsWith("groq/")) return groq(id.slice("groq/".length));
  if (id.startsWith("accounts/fireworks/")) return fireworks(id);
  return id;
}
