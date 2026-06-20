// Turn a StepDescriptor into one short, human narration line for the thinking
// trace. narrateStep asks the fast model for natural prose; if that call fails
// for any reason, it falls back to a deterministic template so the trace never
// blanks. fallbackLabel is pure and unit-tested.

import { complete, BULK_MODEL } from "@/lib/knowledge/llm";
import type { StepDescriptor } from "./step-descriptor";

export function fallbackLabel(d: StepDescriptor): string {
  switch (d.tool) {
    case "list_workspace_sources":
      return "Checked what's available in the workspace.";
    case "ask_workspace_knowledge":
      return d.weak
        ? "Searched the workspace — the first results looked thin."
        : "Searched the workspace for an answer.";
    default:
      return `Used ${d.tool}.`;
  }
}

const SYSTEM =
  "You narrate, in ONE short first-person sentence (max ~16 words), the single step an AI assistant just took while answering a question about a workspace. Be concrete and plain. No preamble, no quotes, no markdown. Example: \"The first search was thin, so I checked what's indexed.\"";

export async function narrateStep(d: StepDescriptor): Promise<string> {
  try {
    const facts = [
      `tool: ${d.tool}`,
      d.query ? `query: ${d.query}` : null,
      typeof d.weak === "boolean" ? `result_was_weak: ${d.weak}` : null,
      typeof d.sourceCount === "number" ? `sources_found: ${d.sourceCount}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const text = await complete(SYSTEM, `Step:\n${facts}\n\nNarrate this one step.`, BULK_MODEL);
    const line = text.trim().replace(/^["']|["']$/g, "").split("\n")[0].trim();
    return line || fallbackLabel(d);
  } catch (err) {
    console.error("[narrateStep] failed; using fallback", err);
    return fallbackLabel(d);
  }
}
