# Agentic Retrieval Loop — Design

**Date:** 2026-06-17
**Status:** Approved design, pre-plan
**Author:** Alex + agent

## Problem

The workspace agent gives up too early. When a user asks a vague-but-answerable
question, the agent reports "I couldn't find it" and pushes the thinking back
onto the user — instead of trying harder, the way a human analyst (or a coding
agent like Claude Code) would.

**Observed failure (2026-06-17):** User asked *"what is the content for the next
5 days?"* The answer existed — `instagram-60-post-calendar.csv` held dated rows
(2026-06-17, 06-18, …). The agent retrieved the *research brief* instead, decided
the calendar wasn't relevant, and answered *"The workspace does not contain any
indexed information about the scheduled content."* The user then had to do the
agent's job: name the file (`@instagram-60-post-calendar.csv`), reframe the
question, and only then got a correct answer.

### Root cause (grounded in code)

The pipeline is **single-shot**:

1. `supervisor-agent.ts` instructs the agent to call `ask_workspace_knowledge`
   once for any data question. No instruction to evaluate, reformulate, or retry.
2. `content-query.ts:43` runs exactly **one** UltraMem search with the user's
   **raw** question — no intent translation. "Next 5 days" (date math over a
   calendar) is searched as a literal phrase against documents that say
   `2026-06-18`, so the calendar scores low and falls outside `topK = 8`.
3. UltraMem returns relevance scores, but the client discards them
   (`ultramem-client.ts:252` keeps only `c.content`) and `content-query.ts:101`
   hardcodes `score: 1`. Nothing can judge "this result is weak."
4. The synthesis prompt (`content-query.ts:114`) correctly answers ONLY from the
   provided excerpts and says "I don't have it" otherwise. This guardrail is
   **right** (anti-hallucination) — the failure is upstream: the wrong excerpts
   were placed in front of it, with no mechanism to notice and recover.

Three capabilities are missing, and they compound:

- **Discovery** — the agent never asks "what sources exist here?" before
  concluding nothing matches. It can't see the menu.
- **Reformulation / intent translation** — no step turns "next 5 days" into a
  retrieval the data can match.
- **Retry loop + confidence signal** — first weak result becomes the final
  answer; no scores means no way to detect weakness.

## Goals

- The agent tries multiple angles before giving up, and only reports "not found"
  after a genuine effort — naming what it *did* find, never a generic "connect a
  document."
- The user can **see the agent's thinking as it works** (chosen behavior):
  streamed reasoning/step lines ("checking sources… found a 60-post calendar…
  filtering to next 5 days… 5 entries").
- The example failure ("content for the next 5 days", no @-reference) produces a
  correct answer without the user naming the file.

## Non-goals

- No change to the anti-hallucination synthesis guardrail. Grounding stays
  ONLY-from-excerpts.
- No new vector store, no Qdrant fallback, no re-architecting UltraMem.
- No changes to the DB SQL path's internals (the loop wraps it, doesn't rewrite
  it).
- Not building generic multi-tool planning — scope is the retrieval loop.

## Design

Principle: **the intelligence lives at the agent loop, not buried inside one
tool call.** A silent query-expansion patch in `content-query.ts` would "work"
but hide the reasoning where it can't be shown or composed. To *show* thinking,
the agent must *have* a visible, multi-step loop.

Four changes, in dependency order:

### 1. Give the agent eyes — `list_workspace_sources` tool

A new, cheap Mastra tool (sibling of `ask_workspace_knowledge` in
`src/mastra/tools/`). Built on the existing `ultramem.timeline({ containerTag })`
(`ultramem-client.ts:266`). Returns a compact catalog of what's indexed: title,
source/type, reference, and — where cheaply available — a hint of structure
(e.g. column headers for tabular files). Identity comes from `RequestContext`,
never the model (same pattern as the knowledge tool).

This single change would have fixed the observed failure: the agent's first move
on a vague request becomes "what's here?" → sees the calendar → pursues it.

### 2. Make retrieval honest — thread real relevance scores through

UltraMem's `/v1/search` response **already includes per-chunk scores**
(confirmed), so this is pure plumbing — no service change, small blast radius.

- `ultramem-client.ts` `search()`: preserve each chunk's score (currently
  dropped at line 252, which keeps only `c.content`).
- `content-query.ts`: replace hardcoded `score: 1` (line 101) with the real
  score; expose the top score / a `weak` signal on `ContentAnswer`.
- `ask_workspace_knowledge` output schema already has `citations[].score` and can
  carry a `confidence`/`weak` flag — surface it so the agent can *read* it.

### 3. Turn the agent into a deliberate loop — revised instructions (+ verify maxSteps)

Rewrite the supervisor instructions from "call the tool" into a **procedure**:

1. For a workspace-data question, if intent is concrete, call
   `ask_workspace_knowledge` directly.
2. If the question is vague, time-relative ("next 5 days", "this week",
   "upcoming"), or the first result comes back **weak/empty**, first call
   `list_workspace_sources` to see what exists.
3. Reformulate using what you see — translate relative dates to absolute ranges,
   target the likely source — and call `ask_workspace_knowledge` again.
4. Only after genuinely exhausting angles, report not-found — and **name what you
   did find** ("I see a 60-post calendar and a research brief; neither covers X").

Mastra 1.42.0 already defaults `maxSteps = 5` (confirmed in
`@mastra/core`), so the loop is **already allowed and already bounded** — the
single-shot behavior is purely a prompt artifact. No config change needed; we
keep the default of 5. The work here is the instructions rewrite plus injecting
**today's date** into the agent context so it can do date math like "next 5
days."

### 4. Show the thinking (chosen behavior)

Stream the loop's intermediate steps to the chat UI as a **richer collapsible
trace** (chosen): each step shows the tool call, the agent's short rationale, and
progress ("found 5 dated rows"), grouped under a collapsible "thinking" panel
that the user can expand/collapse — not just a flat one-line status. The agent
stream already merges into a UI message stream (`route.ts:183-191`); we surface
step/tool events into this trace component. Default collapsed once the final
answer arrives; expandable to inspect the reasoning path.

## Data flow (after)

```
user msg
  └─ supervisor (looped, maxSteps≈5, today's date in context)
       ├─ vague/time-relative/weak? → list_workspace_sources (timeline)  ──┐
       │                                                                   │ visible
       ├─ reformulate (relative→absolute dates, target source)            │ thinking
       ├─ ask_workspace_knowledge (now returns scores + weak flag)  ──────┤ streamed
       ├─ judge: strong enough? no → reformulate & retry (bounded)        │ to UI
       └─ answer (grounded, cited)  OR  honest not-found naming sources ──┘
```

## Error handling

- Bounded loop: hard `maxSteps` cap prevents runaway retries.
- Existing graceful degradations stay (UltraMem down, synthesis model down).
- `list_workspace_sources` failure must not break the turn — degrade to the
  current direct-query path.
- Not-found is still reachable; it just moves to the *end* of a real effort.

## Testing

- **Regression scenario:** "what is the content for the next 5 days?" with the
  calendar indexed and no @-reference → returns the 5 dated rows.
- Vague query ("what's coming up") surfaces the calendar via discovery.
- Weak-score path triggers reformulation, not immediate give-up.
- Genuinely-absent topic → honest not-found that names what was found.
- Loop terminates within `maxSteps` (no infinite retry).
- Anti-hallucination preserved: no invented rows when data is truly absent.

## Resolved decisions

1. **Scores:** UltraMem's `/v1/search` already returns per-chunk scores →
   scoring is pure plumbing, no service change.
2. **Loop bound:** Mastra 1.42.0 defaults `maxSteps = 5` → loop already enabled
   and bounded; keep the default. Single-shot is purely a prompt artifact.
3. **UI depth:** richer collapsible trace (not a minimal one-line status).

## Phasing

Coherent single slice, built in order: (1) discovery tool → (2) scored retrieval
→ (3) looped instructions + maxSteps → (4) visible thinking UI. Phases 1–3 can
be verified via the regression scenario before the UI polish of phase 4.
