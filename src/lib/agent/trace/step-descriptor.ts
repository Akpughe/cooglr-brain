// Pure parsing of one agent step into a structured descriptor for the thinking
// trace. Shape-tolerant by design: the AI-SDK StepResult shape (toolCalls /
// toolResults) can drift across versions (args↔input, result↔output), so we
// read defensively. A step with no tool call is the model's text/answer step —
// we return null so the final answer is never narrated as a "step".

export interface StepDescriptor {
  tool: string;
  query?: string;
  weak?: boolean;
  sourceCount?: number;
}

interface StepLike {
  text?: string;
  toolCalls?: Array<{ toolName?: string; args?: unknown; input?: unknown }>;
  toolResults?: Array<{ toolName?: string; result?: unknown; output?: unknown }>;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

export function describeStep(step: StepLike): StepDescriptor | null {
  const calls = step.toolCalls ?? [];
  if (calls.length === 0) return null;
  const call = calls[calls.length - 1];
  const toolName = call?.toolName;
  if (!toolName) return null;

  const args = asRecord(call.args ?? call.input);
  const results = step.toolResults ?? [];
  const last = results[results.length - 1];
  const res = asRecord(last?.result ?? last?.output);

  const d: StepDescriptor = { tool: toolName };
  const q = args?.question ?? args?.query;
  if (typeof q === "string" && q.trim()) d.query = q;
  if (res && typeof res.weak === "boolean") d.weak = res.weak;
  if (res) {
    if (Array.isArray(res.citations)) d.sourceCount = res.citations.length;
    else if (Array.isArray(res.sources)) d.sourceCount = res.sources.length;
  }
  return d;
}
