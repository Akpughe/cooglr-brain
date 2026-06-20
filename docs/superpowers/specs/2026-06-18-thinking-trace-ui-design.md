# Visible Thinking-Trace UI — Design

**Date:** 2026-06-18
**Status:** Approved design, pre-plan
**Author:** Alex + agent
**Follows:** the agentic retrieval loop (PR #3, `feat/agentic-retrieval-loop`) — the backend that makes the agent discover→reformulate→retry. This slice makes that work *visible*.

## Problem

The agentic retrieval loop now runs multiple steps (discover sources, judge weak results, reformulate, retry) before answering — but the user can't see any of it. The chat shows only a static placeholder: a hardcoded "Worked" disclosure row (`agent-message.tsx` ~lines 354–421) that reads the most recent tool and prints fixed text ("searching workspace and sources"). It does not reflect the real steps the agent took.

The goal Alex set from the start: **show the agent's thinking as it works** — a live, readable trace of what it's doing and why — so the user trusts the result and sees the loop earn its answer, rather than the user doing the thinking.

## Goals

- A **live** trace: each real step appears as the agent takes it, in order.
- Each step shows a **short, natural-language narration** of what the agent did and why (e.g. "First search came back thin, so I checked what's indexed", "Re-searched for content dated 2026-06-18 to 06-22").
- A **richer collapsible panel**: expandable to inspect the path; **auto-collapses** once the final answer arrives.
- **Replaces** the existing fake "Worked" row — one trace, real data.

## Non-goals

- **No persistence** (v1). The trace renders live and stays in the message while the chat/session is open; it is NOT saved to the DB, so reopening an old thread shows only the final answer. (Deferred — avoids schema/serialization work.)
- **No raw model reasoning.** We narrate from the step's tool calls/results, not the model's internal reasoning channel (Groq `gpt-oss-120b` reasoning surfacing through Mastra is unverified). Narration is its own cheap model call.
- **No new dependencies** — reuse the existing CSS-vars styling and native-transition collapsible pattern (no framer-motion/radix).
- **No change** to the retrieval loop logic, the answer grounding, or `AGENT_MAX_STEPS`.

## Architecture

The agent's loop already streams to the client via `createUIMessageStream` + `writer.merge(toAISdkStream(agentStream, { from: "agent" }))` (`route.ts` ~209). Tool-call parts already reach the client; the route already writes custom data parts (`data-thread`, ~207). We add a per-step narration tap:

1. **Tap each step** via `agent.stream(..., { onStepFinish })` (callback confirmed in `@mastra/core` 1.42; fires per step with that step's tool calls + results).
2. **Describe** the step with a pure function → a structured `StepDescriptor` (which tool, key inputs, `weak`, source count). Text-only / final-answer steps return `null` and are not narrated.
3. **Narrate** the descriptor with the fast model → one short sentence, with a **deterministic template fallback** so the trace never blanks on model failure.
4. **Emit** a `data-trace-step` part into the UI stream (`writer.write`). Non-transient (unlike `data-thread`) so it persists in the message's `parts` for the session.
5. **Render** client-side: collect `data-trace-step` parts into an ordered trace in a collapsible panel; auto-collapse when the assistant's final text arrives.

Principle: the narration is a **separate, additive** concern — it never touches the answer stream or grounding. If narration fails entirely, the answer is unaffected.

## Components

| Unit | Responsibility | Tested |
|---|---|---|
| `src/lib/agent/trace/step-descriptor.ts` | **Pure** `describeStep(step) → StepDescriptor \| null`. Maps a Mastra step's tool call+result to `{ tool, query?, weak?, sourceCount? }`. Returns `null` for non-tool/answer steps. | Unit |
| `src/lib/agent/trace/narrate.ts` | `narrateStep(descriptor) → Promise<string>` (fast model). Pure `fallbackLabel(descriptor) → string` templates used on model failure. | Unit (fallback); narration is glue |
| `src/app/api/agent/route.ts` | Wire `onStepFinish`: describe → narrate → `writer.write({ type: "data-trace-step", data })`; track pending narration promises and await before the stream closes. Wrap the callback so a throw can't break the run. | Live |
| `src/components/agent-shell/agent-thinking-trace.tsx` | The collapsible trace component: ordered step rows (icon + narration line), reusing the chevron/disclosure pattern + CSS vars; live while streaming, auto-collapse after final text. | Live |
| `src/components/agent-shell/agent-message.tsx` | Replace the hardcoded "Worked" row (~354–421) with `<AgentThinkingTrace>` fed by the message's `data-trace-step` parts. | Live |

### Types (interfaces between units)

```ts
// step-descriptor.ts
export interface StepDescriptor {
  tool: string;          // e.g. "ask_workspace_knowledge", "list_workspace_sources"
  query?: string;        // the question/query the tool was called with, if any
  weak?: boolean;        // from ask_workspace_knowledge output
  sourceCount?: number;  // # citations or # listed sources, if available
}
// data part written to the stream and read on the client
interface TraceStepData { index: number; tool: string; text: string }
```

## Data flow

```
agent step finishes
  └─ onStepFinish(step)
       ├─ describeStep(step) → StepDescriptor | null
       │     (null → skip: this is the final-answer/text step)
       ├─ narrateStep(descriptor)  → one sentence  (fallbackLabel on failure)
       └─ writer.write({ type: "data-trace-step", data: { index, tool, text } })
                 │
client message.parts gains a data-trace-step part
  └─ AgentThinkingTrace appends the row LIVE
       └─ on final assistant text arriving → panel auto-collapses
```

## Error handling

- `narrateStep` failure → `fallbackLabel(descriptor)` (e.g. "Searched the workspace", "Checked available sources"). The trace degrades to templated text, never blanks.
- `onStepFinish` body wrapped in try/catch — a narration error can never break the agent run or the answer.
- Stream lifecycle: collect narration promises; `await Promise.allSettled(pending)` before `execute` resolves so late narrations aren't dropped.
- Narration latency must not stall the loop: if Mastra awaits `onStepFinish`, keep the call lightweight (one fast-model request); the answer stream proceeds independently via `writer.merge`.

## Testing

- **Unit (pure):** `describeStep` — `ask_workspace_knowledge` weak vs strong → correct `weak`/`sourceCount`; `list_workspace_sources` → tool + count; a text-only/answer step → `null`. `fallbackLabel` — each tool maps to a sensible templated line.
- **Live/manual:** run "what is the content for the next 5 days?" in a workspace with the calendar indexed; confirm the trace streams steps live (discover → re-search → answer), each with a readable narration, then collapses when the answer renders. Confirm a narration failure (simulate by forcing the model call to throw) still yields fallback lines and a correct answer.

## Open questions / risks

1. **Does Mastra await `onStepFinish`?** If it blocks the loop on the narration call, steps narrate serially and add latency. Plan's first step verifies; if blocking, fire narration without awaiting inside the callback and reconcile via the pending-promise set.
2. **`step` shape from `onStepFinish`** — exact field names for tool calls/results must be read from the Mastra types when writing `describeStep` (the plan pins this against `@mastra/core` types, not assumed).

## Scope

One coherent slice: backend tap + narrator (`lib/agent/trace/`), route wiring, one client component, and swapping the fake row. Independently shippable and testable. Persistence and any future raw-reasoning view are out of scope.
