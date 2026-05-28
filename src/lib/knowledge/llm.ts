// Thin LLM helper for the knowledge layer, built on the Vercel AI SDK so the
// model is swappable without touching callers.
//
// Model selection (env KNOWLEDGE_MODEL):
//   - A Fireworks account path (e.g. "accounts/fireworks/models/kimi-k2p5")
//     uses the Fireworks provider directly via FIREWORKS_API_KEY.
//   - Any other "provider/model" string (e.g. "moonshotai/kimi-k2.5",
//     "anthropic/claude-...") is passed straight to the AI SDK, which routes it
//     through the Vercel AI Gateway (AI_GATEWAY_API_KEY) — so switching to
//     other models needs no code change.
//
// Defaults to Kimi K2.5 on Fireworks. DeepSeek V3.2 is
// "accounts/fireworks/models/deepseek-v3p2".

import { generateText } from "ai";
import { fireworks } from "@ai-sdk/fireworks";

// Reasoning model (planning, synthesis) — quality first.
const DEFAULT_MODEL = "accounts/fireworks/models/kimi-k2p5";
// Bulk model (schema enrichment over many tables) — fast, non-thinking.
// gpt-oss-120b on Fireworks: ~1.3s/call vs Kimi's 20-50s, clean JSON.
export const BULK_MODEL =
  process.env.KNOWLEDGE_MODEL_BULK || "accounts/fireworks/models/gpt-oss-120b";

function resolveModel(modelId?: string) {
  const id = modelId || process.env.KNOWLEDGE_MODEL || DEFAULT_MODEL;
  // Fireworks account paths use the Fireworks provider (FIREWORKS_API_KEY);
  // any other "provider/model" string routes through the Vercel AI Gateway.
  return id.startsWith("accounts/fireworks/") ? fireworks(id) : id;
}

// `model` overrides the model for this call (e.g. BULK_MODEL for enrichment).
export async function complete(system: string, user: string, model?: string): Promise<string> {
  const { text } = await generateText({
    model: resolveModel(model),
    system,
    prompt: user,
  });
  return text;
}

// Parse JSON out of a model response, tolerating code fences and leading prose.
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  const start =
    objStart === -1
      ? arrStart
      : arrStart === -1
        ? objStart
        : Math.min(objStart, arrStart);
  if (start === -1) throw new Error("No JSON found in model output");
  return JSON.parse(cleaned.slice(start)) as T;
}
