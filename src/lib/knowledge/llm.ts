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
import { groq } from "@ai-sdk/groq";

// Reasoning + synthesis model. Currently gpt-oss-120b on Groq.
const DEFAULT_MODEL = "groq/openai/gpt-oss-120b";
// Bulk model (schema enrichment over many tables) — fast, non-thinking.
export const BULK_MODEL =
  process.env.KNOWLEDGE_MODEL_BULK || "groq/openai/gpt-oss-120b";

function resolveModel(modelId?: string) {
  const id = modelId || process.env.KNOWLEDGE_MODEL || DEFAULT_MODEL;
  // "groq/<model>" -> Groq provider (GROQ_API_KEY); "accounts/fireworks/..." ->
  // Fireworks; any other "provider/model" string -> the Vercel AI Gateway.
  if (id.startsWith("groq/")) return groq(id.slice("groq/".length));
  if (id.startsWith("accounts/fireworks/")) return fireworks(id);
  return id;
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
