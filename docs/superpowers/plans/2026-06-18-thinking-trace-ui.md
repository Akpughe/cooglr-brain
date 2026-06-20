# Visible Thinking-Trace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the agent's retrieval loop as a live, readable, collapsible "thinking" trace — each real step narrated in plain English as it happens — replacing the current hardcoded "Worked" row.

**Architecture:** The agent route taps each step via `agent.stream(..., { onStepFinish })`. A pure `describeStep(step)` turns the step's tool call+result into a structured descriptor; `narrateStep` (fast Groq model, with a deterministic fallback) turns it into one sentence; the route writes it as a non-transient `data-trace-step` part into the existing UI message stream. The client collects those parts and renders a collapsible panel that's expanded while working and auto-collapses once the answer arrives.

**Tech Stack:** Next.js 16.2.1 App Router, React, TypeScript, Mastra 1.42 (`@mastra/core`), AI SDK UI message stream, Groq `gpt-oss-120b` via `complete`/`BULK_MODEL`, Vitest. Styling: existing CSS-vars in `src/app/agent-shell.css` + native CSS transitions (NO new deps).

## Global Constraints

- **Builds on the agentic-retrieval-loop branch** (`feat/agentic-retrieval-loop`, PR #3) — `ask_workspace_knowledge` returns `weak`, and `list_workspace_sources` exists. Branch this work off that branch, not `main`.
- **No persistence (v1):** the trace is streamed live and lives in the client message for the session; it is NOT saved to the DB. Do not touch `agent_messages` schema or `saveMessage`.
- **No new dependencies.** Reuse `agent-shell.css` CSS variables and the existing chevron/`btn-ghost` collapsible pattern. No framer-motion/radix.
- **Narration must never break the run or the answer.** `onStepFinish` body is fully wrapped in try/catch; narration failure falls back to a deterministic template line.
- **Do not change** the retrieval loop logic, the synthesis/grounding prompt, `AGENT_MAX_STEPS` (=16), or the `toAISdkStream(agentStream, { from: "agent" })` options.
- **Identity** still comes from `RequestContext`; this slice does not touch tool identity.
- **Test runner:** `npx vitest run <path>` for one file; `npm test` for the suite; `npx tsc --noEmit` for types.

---

### Task 1: Trace core — `describeStep`, `fallbackLabel`, `narrateStep` (pure-first, unit-tested)

The shape-tolerant step parser + the narrator, isolated in `src/lib/agent/trace/`. The parsing and fallback logic are pure and fully unit-tested; the model call is thin glue over them.

**Files:**
- Create: `src/lib/agent/trace/step-descriptor.ts`
- Create: `src/lib/agent/trace/narrate.ts`
- Test: `src/lib/agent/trace/__tests__/step-descriptor.test.ts`
- Test: `src/lib/agent/trace/__tests__/narrate.test.ts`

**Interfaces:**
- Consumes: `complete`, `BULK_MODEL` from `@/lib/knowledge/llm`.
- Produces:
  - `interface StepDescriptor { tool: string; query?: string; weak?: boolean; sourceCount?: number }`
  - `describeStep(step: StepLike): StepDescriptor | null`
  - `fallbackLabel(d: StepDescriptor): string`
  - `narrateStep(d: StepDescriptor): Promise<string>`

- [ ] **Step 1: Write the failing test for `describeStep`**

Create `src/lib/agent/trace/__tests__/step-descriptor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { describeStep } from "../step-descriptor";

describe("describeStep", () => {
  it("returns null for a text-only step (no tool calls = the final answer)", () => {
    expect(describeStep({ text: "Here are the 5 posts…", toolCalls: [], toolResults: [] })).toBeNull();
    expect(describeStep({ text: "hi" })).toBeNull();
  });

  it("describes an ask_workspace_knowledge step with a weak result", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "ask_workspace_knowledge", args: { question: "content next 5 days" } }],
      toolResults: [{ toolName: "ask_workspace_knowledge", result: { weak: true, citations: [] } }],
    });
    expect(d).toEqual({ tool: "ask_workspace_knowledge", query: "content next 5 days", weak: true, sourceCount: 0 });
  });

  it("describes a strong knowledge result with a source count", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "ask_workspace_knowledge", args: { question: "q" } }],
      toolResults: [{ toolName: "ask_workspace_knowledge", result: { weak: false, citations: [{ fileId: "a" }, { fileId: "b" }] } }],
    });
    expect(d).toEqual({ tool: "ask_workspace_knowledge", query: "q", weak: false, sourceCount: 2 });
  });

  it("describes a list_workspace_sources step (sources array → count)", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "list_workspace_sources", args: {} }],
      toolResults: [{ toolName: "list_workspace_sources", result: { sources: [{ title: "x" }, { title: "y" }, { title: "z" }] } }],
    });
    expect(d).toEqual({ tool: "list_workspace_sources", sourceCount: 3 });
  });

  it("tolerates input/output field aliases and uses the last tool call", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "list_workspace_sources", input: {} }, { toolName: "ask_workspace_knowledge", input: { query: "later" } }],
      toolResults: [{ toolName: "ask_workspace_knowledge", output: { weak: false, citations: [{ fileId: "a" }] } }],
    });
    expect(d).toEqual({ tool: "ask_workspace_knowledge", query: "later", weak: false, sourceCount: 1 });
  });

  it("returns null when the last tool call has no toolName", () => {
    expect(describeStep({ toolCalls: [{ args: {} }], toolResults: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/agent/trace/__tests__/step-descriptor.test.ts`
Expected: FAIL — `Cannot find module '../step-descriptor'`.

- [ ] **Step 3: Implement `step-descriptor.ts`**

Create `src/lib/agent/trace/step-descriptor.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/agent/trace/__tests__/step-descriptor.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing test for `fallbackLabel`**

Create `src/lib/agent/trace/__tests__/narrate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fallbackLabel } from "../narrate";

describe("fallbackLabel", () => {
  it("labels a source-discovery step", () => {
    expect(fallbackLabel({ tool: "list_workspace_sources", sourceCount: 3 })).toBe("Checked what's available in the workspace.");
  });
  it("labels a weak knowledge search", () => {
    expect(fallbackLabel({ tool: "ask_workspace_knowledge", weak: true })).toBe("Searched the workspace — the first results looked thin.");
  });
  it("labels a normal knowledge search", () => {
    expect(fallbackLabel({ tool: "ask_workspace_knowledge", weak: false })).toBe("Searched the workspace for an answer.");
  });
  it("labels an unknown tool generically", () => {
    expect(fallbackLabel({ tool: "gmail_search" })).toBe("Used gmail_search.");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/lib/agent/trace/__tests__/narrate.test.ts`
Expected: FAIL — `Cannot find module '../narrate'`.

- [ ] **Step 7: Implement `narrate.ts`**

Create `src/lib/agent/trace/narrate.ts`:

```ts
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
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/lib/agent/trace/__tests__/narrate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/agent/trace
git commit -m "feat(trace): pure step-descriptor + narrator for thinking trace"
```

---

### Task 2: Route wiring — narrate each step into a `data-trace-step` stream part

Tap `onStepFinish`, narrate, and write a non-transient `data-trace-step` part. Because the AI-SDK loop awaits `onStepFinish`, narrating inside it guarantees ordering and that every part is written before the stream closes.

**Files:**
- Modify: `src/app/api/agent/route.ts` (imports near the other `@/mastra`/`@/lib` imports; the `agentStream`/`createUIMessageStream` block ~lines 192–211)

**Interfaces:**
- Consumes: `describeStep` (`@/lib/agent/trace/step-descriptor`), `narrateStep` (`@/lib/agent/trace/narrate`).
- Produces: a stream part `{ type: "data-trace-step", data: { index: number; tool: string; text: string } }` consumed by Task 3.

- [ ] **Step 1: Add imports**

In `src/app/api/agent/route.ts`, add near the existing `@/mastra` / `@/lib/knowledge` imports at the top:

```ts
import { describeStep } from "@/lib/agent/trace/step-descriptor";
import { narrateStep } from "@/lib/agent/trace/narrate";
```

- [ ] **Step 2: Wire the per-step narration tap**

Replace this block (currently ~lines 192–211):

```ts
  let agentStream: Awaited<ReturnType<typeof agent.stream>>;
  try {
    agentStream = await agent.stream(effectiveMessages as never, { requestContext, maxSteps: AGENT_MAX_STEPS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runId) await finishRun({ runId, status: "error", error: msg });
    return new Response(`Agent failed to start: ${msg}`, { status: 500 });
  }

  const uiStream = createUIMessageStream({
    originalMessages: messages as never,
    execute: ({ writer }) => {
      // Surface the (possibly newly-created) thread id so the client can update
      // its URL/sidebar without a reload.
      if (activeThreadId) {
        writer.write({ type: "data-thread", data: { threadId: activeThreadId }, transient: true } as never);
      }
      writer.merge(toAISdkStream(agentStream, { from: "agent" }) as never);
    },
```

with:

```ts
  // Thinking trace: narrate each agent step live into a `data-trace-step` part.
  // `onStepFinish` is awaited by the loop, so narrating here preserves order and
  // guarantees every part is written before the stream closes. Fully guarded —
  // a narration error can never break the run or the answer.
  let traceWriter: { write: (part: unknown) => void } | null = null;
  let traceIndex = 0;
  const onStepFinish = async (step: unknown) => {
    try {
      if (!traceWriter) return;
      const descriptor = describeStep(step as never);
      if (!descriptor) return;
      const text = await narrateStep(descriptor);
      traceWriter.write({
        type: "data-trace-step",
        data: { index: traceIndex++, tool: descriptor.tool, text },
      });
    } catch (err) {
      console.error("[agent route] trace narration failed", err);
    }
  };

  let agentStream: Awaited<ReturnType<typeof agent.stream>>;
  try {
    agentStream = await agent.stream(effectiveMessages as never, {
      requestContext,
      maxSteps: AGENT_MAX_STEPS,
      onStepFinish: onStepFinish as never,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runId) await finishRun({ runId, status: "error", error: msg });
    return new Response(`Agent failed to start: ${msg}`, { status: 500 });
  }

  const uiStream = createUIMessageStream({
    originalMessages: messages as never,
    execute: ({ writer }) => {
      // Let onStepFinish (which fires during stream consumption below) write
      // trace parts to this writer.
      traceWriter = writer as never;
      // Surface the (possibly newly-created) thread id so the client can update
      // its URL/sidebar without a reload.
      if (activeThreadId) {
        writer.write({ type: "data-thread", data: { threadId: activeThreadId }, transient: true } as never);
      }
      writer.merge(toAISdkStream(agentStream, { from: "agent" }) as never);
    },
```

(The `data-trace-step` part is written WITHOUT `transient`, so — unlike `data-thread` — it is retained in the client message's `parts` array, which Task 3 reads.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/agent/route.ts
git commit -m "feat(trace): narrate each agent step into a data-trace-step stream part"
```

---

### Task 3: Client — collapsible trace component, swapped in for the "Worked" row

Render the streamed `data-trace-step` parts as a live, collapsible trace; replace the hardcoded "Worked" disclosure.

**Files:**
- Create: `src/components/agent-shell/agent-thinking-trace.tsx`
- Modify: `src/components/agent-shell/agent-message.tsx` (the assistant turn's "Worked" disclosure block, ~lines 354–421; helper region near `toolNameOf` ~line 371)
- Modify: `src/app/agent-shell.css` (append trace styles)

**Interfaces:**
- Consumes: `data-trace-step` parts from the message — each `{ type: "data-trace-step", data: { index, tool, text } }`.
- Produces: `AgentThinkingTrace` component; a local `traceSteps(parts)` helper in `agent-message.tsx`.

- [ ] **Step 1: Create the trace component**

Create `src/components/agent-shell/agent-thinking-trace.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export interface TraceStep {
  index: number;
  tool: string;
  text: string;
}

/**
 * The agent's live "thinking" trace: one row per narrated step. Expanded while
 * the agent is still working (no final answer yet), auto-collapsed once the
 * answer has arrived; the user can toggle either way.
 */
export function AgentThinkingTrace({ steps, answered }: { steps: TraceStep[]; answered: boolean }) {
  const [override, setOverride] = useState<boolean | null>(null);
  if (steps.length === 0) return null;

  const open = override ?? !answered;
  const label = answered
    ? `Thought through ${steps.length} step${steps.length === 1 ? "" : "s"}`
    : "Thinking…";

  return (
    <div className="agent-trace">
      <button
        type="button"
        className="btn-ghost agent-trace-toggle"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
      >
        <ChevronRight
          size={14}
          style={{ transform: open ? "rotate(90deg)" : "", transition: "transform .15s ease" }}
        />
        <span>{label}</span>
      </button>
      {open && (
        <ol className="agent-trace-steps">
          {[...steps]
            .sort((a, b) => a.index - b.index)
            .map((s) => (
              <li key={s.index} className="agent-trace-step">
                {s.text}
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add trace styles**

Append to `src/app/agent-shell.css`:

```css
/* Thinking trace — the agent's live step narration. */
.agent-shell-root .agent-trace { margin: 4px 0 8px; }
.agent-shell-root .agent-trace-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--ink-3);
}
.agent-shell-root .agent-trace-steps {
  list-style: none; margin: 6px 0 0; padding: 0 0 0 8px;
  border-left: 1px solid var(--line, rgba(0,0,0,.08));
  display: flex; flex-direction: column; gap: 4px;
}
.agent-shell-root .agent-trace-step {
  font-size: 13px; line-height: 1.45; color: var(--ink-2);
  padding-left: 8px;
}
```

(If `--line` is not defined in the file, use the closest existing border token; check the `:root`/`.agent-shell-root` variable block at the top of `agent-shell.css`.)

- [ ] **Step 3: Read `agent-message.tsx` and swap in the trace**

Read `src/components/agent-shell/agent-message.tsx`. Locate the assistant turn's "Worked" disclosure (the `btn-ghost` button using the `workedLabel`/`liveActivity` value with its `open` state and expanded `<div>` of hardcoded text, ~lines 354–421).

Add this helper near the other part helpers (e.g. just after `toolNameOf`, ~line 371):

```tsx
function traceSteps(parts: Part[]): { index: number; tool: string; text: string }[] {
  return parts
    .filter((p) => p.type === "data-trace-step" && p.data && typeof p.data === "object")
    .map((p) => p.data as { index: number; tool: string; text: string });
}

function hasFinalText(parts: Part[]): boolean {
  return parts.some((p) => p.type === "text" && typeof p.text === "string" && p.text.trim().length > 0);
}
```

If the `Part` type (declared ~lines 18–24) does not already allow arbitrary `data` parts, widen it to include `data?: unknown` (it already carries optional fields like `toolName`, `output`).

Replace the entire "Worked" disclosure block with the new trace, fed from the message parts in scope (the same `parts` array the turn already uses):

```tsx
<AgentThinkingTrace steps={traceSteps(parts)} answered={hasFinalText(parts)} />
```

Add the import at the top of the file:

```tsx
import { AgentThinkingTrace } from "./agent-thinking-trace";
```

Remove any now-dead `liveActivity`/`workedLabel`/`open`/`setOpen` code that solely served the old disclosure (leave anything still used by the right-side artifact panel untouched).

- [ ] **Step 4: Type-check and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: PASS (including Task 1's `step-descriptor` + `narrate` tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/agent-shell/agent-thinking-trace.tsx src/components/agent-shell/agent-message.tsx src/app/agent-shell.css
git commit -m "feat(trace): live collapsible thinking-trace UI, replacing the Worked row"
```

---

### Task 4: Live verification

Confirm the trace streams live and reads well, end-to-end. Manual/live (matches the repo's `*.live.test.ts` convention — not part of `npm test`).

**Files:**
- Create: `docs/superpowers/verification/2026-06-18-thinking-trace-ui.md`

**Interfaces:**
- Consumes: running app (`npm run dev`), local UltraMem, a workspace with `instagram-60-post-calendar.csv` indexed.

- [ ] **Step 1: Preconditions**

Run: `curl -s http://localhost:8080/v1/health`
Expected: `{"ok":true}`. Confirm the calendar is indexed in the test workspace.

- [ ] **Step 2: Run the loop prompt and watch the trace**

`npm run dev`; in a new chat, send: **"what is the content for the next 5 days?"**

Expected:
- While the agent works, a **"Thinking…"** panel appears and grows **live**: a row per step (e.g. "Checked what's available…", "Searched the workspace — the first results looked thin.", "Re-searched for the content dates…").
- When the answer renders, the panel **auto-collapses** to **"Thought through N steps"**, expandable on click.
- The final answer is correct (the dated rows), unchanged by the trace.

- [ ] **Step 3: Verify graceful degradation**

Temporarily force narration to fail (e.g. set an invalid `KNOWLEDGE_MODEL_BULK` in `.env.local`, restart dev). Re-run the prompt.
Expected: trace still shows rows using the **fallback** labels ("Searched the workspace…"), and the answer is still correct. Restore `.env.local` afterward.

- [ ] **Step 4: Record results + commit**

Create `docs/superpowers/verification/2026-06-18-thinking-trace-ui.md` with the prompts, what rendered (paste/screenshot notes), whether each expectation held, and any narration-wording tuning.

```bash
git add docs/superpowers/verification/2026-06-18-thinking-trace-ui.md
git commit -m "docs: verification of live thinking-trace UI"
```

---

## Self-Review Notes

- **Spec coverage:** live per-step trace (Tasks 2+3), LLM narration with fallback (Task 1), collapsible + auto-collapse (Task 3), replaces the "Worked" row (Task 3), no persistence / no new deps (Global Constraints), narration never breaks the run (Task 2 guard + Task 1 fallback), live verification incl. degradation (Task 4). ✔
- **Type consistency:** `StepDescriptor` (Task 1) consumed by `narrateStep`/route (Tasks 1–2); the `data-trace-step` data shape `{ index, tool, text }` is identical in route (Task 2), `traceSteps` and `TraceStep`/`AgentThinkingTrace` (Task 3). `describeStep(step)` signature matches its test and the route call. ✔
- **Open risks pinned:** `onStepFinish` is awaited (resolves ordering/lifecycle); `describeStep` is shape-tolerant (args/input, result/output) and verified live in Task 4. ✔
- **No placeholders:** every code step has complete code; every run step has the command + expected result. ✔
