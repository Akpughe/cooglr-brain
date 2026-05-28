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

const DEFAULT_MODEL = "accounts/fireworks/models/kimi-k2p5";

function resolveModel() {
  const id = process.env.KNOWLEDGE_MODEL || DEFAULT_MODEL;
  return id.startsWith("accounts/fireworks/") ? fireworks(id) : id;
}

export async function complete(system: string, user: string): Promise<string> {
  const { text } = await generateText({
    model: resolveModel(),
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
