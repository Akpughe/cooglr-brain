# Agentic Retrieval Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workspace agent try multiple retrieval angles — discover available sources, judge result strength, reformulate, and retry — before ever saying "I couldn't find it."

**Architecture:** The intelligence lives at the agent loop (Mastra supervisor), not buried in one tool call. We give the agent (a) eyes — a `list_workspace_sources` tool, (b) an honest confidence signal — real per-chunk relevance scores threaded through to a `weak` flag, and (c) a procedure + today's date so it can discover, reformulate (e.g. "next 5 days" → an absolute date range), and retry within Mastra's existing 5-step loop.

**Tech Stack:** Next.js 16 App Router, TypeScript, Mastra 1.42 (`@mastra/core`), UltraMem (HTTP), Vitest, Zod.

## Global Constraints

- **Anti-hallucination guardrail is untouched.** The synthesis prompt in `content-query.ts` ("answer using ONLY the provided excerpts … never invent") stays exactly as-is. This plan changes what excerpts reach it, never the grounding rule.
- **Identity always from `RequestContext`, never the model.** Every new tool reads `workspaceId`/`userId` via `readContext(context)` (`src/mastra/context/request-context.ts`), matching `knowledge-tools.ts` / `memory-tools.ts`.
- **Mastra default `maxSteps = 5`** (confirmed in `@mastra/core` 1.42.0). Do NOT set it explicitly; the default is the intended bound. The loop is enabled by instructions, not config.
- **Server-only:** `src/lib/memory/ultramem-client.ts` must never be imported from client code.
- **Test philosophy (match the codebase):** unit-test pure functions with Vitest; leave LLM/UltraMem integration to `*.live.test.ts` and the manual regression scenario. Do NOT add heavy service mocks.
- **Test runner:** `npx vitest run <path>` for a single file; `npm test` for the suite.

---

### Task 1: Thread real relevance scores end-to-end + weak-result detection

UltraMem's `/v1/search` already returns per-chunk scores; the client type and normalizer currently drop them, and `content-query.ts` hardcodes `score: 1`. This task carries the real score through and derives a `weak` signal the agent can read.

**Files:**
- Create: `src/lib/knowledge/relevance.ts`
- Test: `src/lib/knowledge/__tests__/relevance.test.ts`
- Modify: `src/lib/memory/ultramem-client.ts` (raw chunk type ~line 178; `UltraMemDocument.snippets` ~line 62; `search()` normalizer ~line 252)
- Modify: `src/lib/knowledge/content-query.ts` (`ContentAnswer` ~line 5; excerpt build ~line 73; citations ~line 101; empty/error/success returns)
- Modify: `src/mastra/tools/memory-tools.ts:84` (snippets consumer)
- Modify: `src/lib/knowledge/router.ts` (`UnifiedAnswer` ~line 13; content-branch returns ~lines 149/156/177/200)
- Modify: `src/mastra/tools/knowledge-tools.ts` (output schema ~line 32; return ~line 60)

**Interfaces:**
- Produces:
  - `WEAK_SCORE_FLOOR: number`
  - `topScore(scores: number[]): number`
  - `isWeakResult(scores: number[]): boolean`
  - `UltraMemDocument.snippets: { text: string; score: number }[]` (was `string[]`)
  - `ContentAnswer.weak: boolean` and `UnifiedAnswer.weak?: boolean`
  - `ask_workspace_knowledge` output gains `weak: boolean`

- [ ] **Step 1: Write the failing test for the relevance helper**

Create `src/lib/knowledge/__tests__/relevance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { topScore, isWeakResult, WEAK_SCORE_FLOOR } from "../relevance";

describe("relevance helpers", () => {
  it("topScore returns the max, or 0 for empty", () => {
    expect(topScore([0.1, 0.9, 0.4])).toBe(0.9);
    expect(topScore([])).toBe(0);
  });

  it("isWeakResult is true for empty results", () => {
    expect(isWeakResult([])).toBe(true);
  });

  it("isWeakResult is true when the best score is below the floor", () => {
    expect(isWeakResult([WEAK_SCORE_FLOOR - 0.01])).toBe(true);
  });

  it("isWeakResult is false when a score meets the floor", () => {
    expect(isWeakResult([WEAK_SCORE_FLOOR, 0.1])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/knowledge/__tests__/relevance.test.ts`
Expected: FAIL — `Cannot find module '../relevance'`.

- [ ] **Step 3: Create the relevance module**

Create `src/lib/knowledge/relevance.ts`:

```ts
// Relevance scoring helpers for retrieved excerpts.
//
// UltraMem returns a per-chunk similarity score (higher = closer). We use the
// best score across the retrieved set to decide whether a result is strong
// enough to answer from, or "weak" — in which case the agent should discover
// available sources and reformulate before giving up.

/**
 * Minimum top score for a retrieval to count as "strong". Tunable: if the agent
 * reformulates too eagerly, lower it; if it answers from junk, raise it.
 */
export const WEAK_SCORE_FLOOR = 0.35;

/** Highest score in the set, or 0 when empty. */
export function topScore(scores: number[]): number {
  return scores.length ? Math.max(...scores) : 0;
}

/** A result is weak when it's empty or its best score is below the floor. */
export function isWeakResult(scores: number[]): boolean {
  return topScore(scores) < WEAK_SCORE_FLOOR;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/knowledge/__tests__/relevance.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Carry the score through the UltraMem client**

In `src/lib/memory/ultramem-client.ts`:

Change the raw chunk type (~line 178) from:

```ts
  chunks?: Array<{ content: string }>;
```
to:
```ts
  chunks?: Array<{ content: string; score?: number }>;
```

Change `UltraMemDocument.snippets` (~line 62) from:

```ts
  snippets: string[];
```
to:
```ts
  snippets: { text: string; score: number }[];
```

Change the `search()` normalizer (~line 252) from:

```ts
        snippets: (d.chunks ?? []).map((c) => c.content),
```
to:
```ts
        snippets: (d.chunks ?? []).map((c) => ({ text: c.content, score: c.score ?? 0 })),
```

- [ ] **Step 6: Update the `memory-tools.ts` snippets consumer**

In `src/mastra/tools/memory-tools.ts:84`, change:

```ts
      const memories = [...res.memories, ...res.documents.flatMap((d) => d.snippets)];
```
to:
```ts
      const memories = [...res.memories, ...res.documents.flatMap((d) => d.snippets.map((s) => s.text))];
```

- [ ] **Step 7: Use real scores + weak flag in `content-query.ts`**

In `src/lib/knowledge/content-query.ts`:

Add the import at the top (after the existing imports):

```ts
import { isWeakResult } from "./relevance";
```

Add `weak` to the `ContentAnswer` interface (~line 5):

```ts
export interface ContentAnswer {
  answerMd: string;
  citations: { fileId: string; score: number; title?: string; source?: string }[];
  chunksUsed: number;
  category?: string | null;
  origins?: string[];
  weak: boolean; // true when retrieval was empty or low-relevance
}
```

Change the excerpt type and build (~line 72) to carry the score:

```ts
  type Excerpt = { fileId: string; source?: string; title?: string; text: string; score: number };
  let docExcerpts: Excerpt[] = res.documents.flatMap((d) =>
    d.snippets.map((s) => ({ fileId: d.reference || d.id, source: d.source, title: d.title, text: s.text, score: s.score })),
  );
```

Change the memory-excerpt build (~line 78) to give memories a neutral score of 1:

```ts
  const memExcerpts: Excerpt[] = focusSet
    ? []
    : res.memories.map((m, i) => ({ fileId: `memory:${i + 1}`, source: "memory", title: "Memory", text: m, score: 1 }));
```

Update the empty-result return (~line 86) to include `weak: true`:

```ts
  if (all.length === 0) {
    return {
      answerMd: focusSet
        ? "I couldn't find anything about that in the referenced document(s)."
        : "I couldn't find anything relevant in this workspace's memory yet.",
      citations: [],
      chunksUsed: 0,
      category: null,
      origins: [],
      weak: true,
    };
  }
```

Replace the hardcoded citation score (~line 101) with the real one and compute weak:

```ts
  const citations = all.map((e) => ({ fileId: e.fileId, score: e.score, title: e.title, source: e.source }));
  const weak = isWeakResult(all.map((e) => e.score));
```

Add `weak: true` to the UltraMem-error return (~line 62) and the synthesis-error return (~line 120), and add `weak` to the final success return (~line 130):

```ts
  // UltraMem-error return:
      origins: [],
      weak: true,
    };
```
```ts
  // synthesis-error return: keep its existing fields and add:
      origins: originsForHit,
      weak,
    };
```
```ts
  // final success return:
  return { answerMd, citations, chunksUsed: all.length, category: null, origins: originsForHit, weak };
```

(Note: in the synthesis-error branch `weak` is already computed above its `try`, so it is in scope.)

- [ ] **Step 8: Thread `weak` through the router**

In `src/lib/knowledge/router.ts`:

Add to the `UnifiedAnswer` interface (~line 23, in the content section):

```ts
  weak?: boolean; // true when the content retrieval was empty or low-relevance
```

In `runUnifiedQuery`, add `weak: c.weak` to each content-only return (the `focusFileIds` branch ~line 149, the no-DB branch ~line 156, and the DB-only catch fallback ~line 177). Example for the no-DB branch:

```ts
    return { source: "content", answerMd: c.answerMd, citations: c.citations, origins: c.origins, weak: c.weak };
```

In the merge branch return (~line 192), add:

```ts
    weak: contentRes.weak,
```

- [ ] **Step 9: Surface `weak` on the `ask_workspace_knowledge` tool**

In `src/mastra/tools/knowledge-tools.ts`:

Add to the `outputSchema` object (~line 32):

```ts
    weak: z.boolean(),
```

Add to the returned object (~line 60):

```ts
      weak: ans.weak ?? false,
```

Update the tool `description` (~line 24) to end with one extra sentence so the model knows the flag exists:

```ts
    "data, documents, metrics, records or files — it is the source of truth. " +
    "If `weak` is true, the result was empty or low-relevance — discover sources and retry.",
```

- [ ] **Step 10: Type-check and run the full unit suite**

Run: `npx tsc --noEmit`
Expected: no errors (confirms both `.snippets` consumers and all `weak` returns are consistent).

Run: `npm test`
Expected: PASS, including the new `relevance.test.ts`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/knowledge/relevance.ts src/lib/knowledge/__tests__/relevance.test.ts src/lib/memory/ultramem-client.ts src/lib/knowledge/content-query.ts src/mastra/tools/memory-tools.ts src/lib/knowledge/router.ts src/mastra/tools/knowledge-tools.ts
git commit -m "feat(knowledge): thread real relevance scores + weak-result signal"
```

---

### Task 2: `list_workspace_sources` tool — give the agent eyes

A cheap discovery tool so the agent can see what's indexed before concluding nothing matches. Built on the existing `ultramem.timeline({ containerTag })`.

**Files:**
- Create: `src/mastra/tools/sources-tools.ts`
- Test: `src/mastra/tools/__tests__/sources-catalog.test.ts`
- Modify: `src/mastra/agents/supervisor-agent.ts` (import + `tools` map ~line 38)

**Interfaces:**
- Consumes: `ultramem.timeline` (`src/lib/memory/ultramem-client.ts`), `scopes.workspace` (`src/lib/memory/scopes.ts`), `readContext` (`src/mastra/context/request-context.ts`).
- Produces: `listWorkspaceSources` (Mastra tool, id `list_workspace_sources`); pure helper `toSourceCatalog(items): { title: string; type: string; reference?: string }[]`.

- [ ] **Step 1: Write the failing test for the pure catalog formatter**

Create `src/mastra/tools/__tests__/sources-catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toSourceCatalog } from "../sources-tools";

describe("toSourceCatalog", () => {
  it("normalizes timeline items into a compact catalog", () => {
    const out = toSourceCatalog([
      { documentId: "1", title: "instagram-60-post-calendar.csv", source: "file", reference: "file-1" },
      { documentId: "2", title: "research-brief.md", source: "file", reference: "file-2" },
    ]);
    expect(out).toEqual([
      { title: "instagram-60-post-calendar.csv", type: "documents", reference: "file-1" },
      { title: "research-brief.md", type: "documents", reference: "file-2" },
    ]);
  });

  it("dedupes by title and falls back to 'Untitled' / 'documents'", () => {
    const out = toSourceCatalog([
      { documentId: "1", title: "dup.csv", source: "file" },
      { documentId: "2", title: "dup.csv", source: "file" },
      { documentId: "3" },
    ]);
    expect(out).toEqual([
      { title: "dup.csv", type: "documents", reference: undefined },
      { title: "Untitled", type: "documents", reference: undefined },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/mastra/tools/__tests__/sources-catalog.test.ts`
Expected: FAIL — `Cannot find module '../sources-tools'`.

- [ ] **Step 3: Create the sources tool + pure formatter**

Create `src/mastra/tools/sources-tools.ts`:

```ts
// list_workspace_sources — the agent's "eyes" over what's indexed.
//
// Returns a compact catalog of the documents/sources in this workspace so the
// agent can, when a question is vague or a search came back weak, see what
// exists and target the right source — instead of concluding "nothing found".
// Identity (workspace) comes from the trusted RequestContext, never the model.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ultramem, type UltraMemTimelineItem } from "@/lib/memory/ultramem-client";
import { scopes } from "@/lib/memory/scopes";
import { readContext } from "../context/request-context";

// Human label for an origin, mirroring content-query's ORIGIN_LABELS.
const ORIGIN_LABELS: Record<string, string> = {
  gmail: "Gmail",
  slack: "Slack",
  github: "GitHub",
  "google-drive": "Google Drive",
  file: "documents",
  manual: "documents",
  memory: "memory",
};

/** Normalize timeline items into a compact, deduped catalog (pure; unit-tested). */
export function toSourceCatalog(
  items: UltraMemTimelineItem[],
): { title: string; type: string; reference?: string }[] {
  const seen = new Set<string>();
  const out: { title: string; type: string; reference?: string }[] = [];
  for (const it of items) {
    const title = (it.title ?? "").trim() || "Untitled";
    if (seen.has(title)) continue;
    seen.add(title);
    out.push({
      title,
      type: (it.source && ORIGIN_LABELS[it.source]) || "documents",
      reference: it.reference,
    });
  }
  return out;
}

export const listWorkspaceSources = createTool({
  id: "list_workspace_sources",
  description:
    "List the documents and sources indexed in this workspace (titles + type). " +
    "Call this when a question is vague, time-relative ('next 5 days', 'this week', " +
    "'upcoming'), or when ask_workspace_knowledge came back weak/empty — so you can " +
    "see what exists and target the right source before answering or giving up.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    sources: z.array(
      z.object({
        title: z.string(),
        type: z.string(),
        reference: z.string().optional(),
      }),
    ),
  }),
  execute: async (_input, context) => {
    const { workspaceId } = readContext(context);
    try {
      const res = await ultramem.timeline({ containerTag: scopes.workspace(workspaceId), limit: 200 });
      return { sources: toSourceCatalog(res.items) };
    } catch (err) {
      console.error("[list_workspace_sources] failed", err);
      return { sources: [] };
    }
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/mastra/tools/__tests__/sources-catalog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Register the tool on the supervisor**

In `src/mastra/agents/supervisor-agent.ts`, add the import (after line 7):

```ts
import { listWorkspaceSources } from "../tools/sources-tools";
```

Change the `tools` map (~line 38) from:

```ts
  tools: { askWorkspaceKnowledge, saveMemory, recallMemory, requestApproval },
```
to:
```ts
  tools: { askWorkspaceKnowledge, listWorkspaceSources, saveMemory, recallMemory, requestApproval },
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `UltraMemTimelineItem` is exported and the tool wiring is valid).

- [ ] **Step 7: Commit**

```bash
git add src/mastra/tools/sources-tools.ts src/mastra/tools/__tests__/sources-catalog.test.ts src/mastra/agents/supervisor-agent.ts
git commit -m "feat(agent): add list_workspace_sources discovery tool"
```

---

### Task 3: Turn the supervisor into a deliberate loop (instructions + today's date)

The loop is already allowed (maxSteps=5). This task rewrites the instructions into a discover→try→judge→reformulate→only-then-give-up procedure, and injects today's date so the agent can resolve relative ranges like "next 5 days".

**Files:**
- Create: `src/mastra/context/date-note.ts`
- Test: `src/mastra/context/__tests__/date-note.test.ts`
- Modify: `src/app/api/agent/route.ts` (effectiveMessages ~lines 107-112)
- Modify: `src/mastra/agents/supervisor-agent.ts` (`INSTRUCTIONS` ~lines 9-31)

**Interfaces:**
- Produces: `buildDateSystemNote(now: Date): string`.
- Consumes: existing `effectiveMessages` system-message prepend pattern in `route.ts`.

- [ ] **Step 1: Write the failing test for the date note**

Create `src/mastra/context/__tests__/date-note.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDateSystemNote } from "../date-note";

describe("buildDateSystemNote", () => {
  it("includes the ISO date for relative date math", () => {
    const note = buildDateSystemNote(new Date("2026-06-17T09:00:00Z"));
    expect(note).toContain("2026-06-17");
  });

  it("instructs the agent to use it for relative ranges", () => {
    const note = buildDateSystemNote(new Date("2026-06-17T09:00:00Z"));
    expect(note.toLowerCase()).toContain("relative");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/mastra/context/__tests__/date-note.test.ts`
Expected: FAIL — `Cannot find module '../date-note'`.

- [ ] **Step 3: Create the date-note helper**

Create `src/mastra/context/date-note.ts`:

```ts
// A system note carrying "today" into the agent run, so it can resolve
// relative ranges ("next 5 days", "this week", "upcoming") to absolute dates.
// Uses server time (UTC date); good enough for day-granularity reasoning.

export function buildDateSystemNote(now: Date): string {
  const iso = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const weekday = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return `Today's date is ${iso} (${weekday}). When a question uses a relative time range (e.g. "next 5 days", "this week", "upcoming", "recent"), convert it to an explicit absolute date range from today before searching.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/mastra/context/__tests__/date-note.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Prepend the date note in the agent route**

In `src/app/api/agent/route.ts`, add the import near the other `@/mastra` imports at the top of the file:

```ts
import { buildDateSystemNote } from "@/mastra/context/date-note";
```

Replace the `effectiveMessages` block (~lines 107-112) with one that always prepends the date note, then the optional persona:

```ts
  const dateNote = { role: "system", content: buildDateSystemNote(new Date()) };
  const personaNote = personaInstructions
    ? {
        role: "system",
        content: `Workspace operating instructions (set by the workspace owner — follow these in addition to your core behaviour):\n${personaInstructions}`,
      }
    : null;
  const effectiveMessages = [
    dateNote,
    ...(personaNote ? [personaNote] : []),
    ...(messages as UIMessageLike[]),
  ];
```

- [ ] **Step 6: Rewrite the supervisor instructions into a procedure**

In `src/mastra/agents/supervisor-agent.ts`, replace the `Core behaviour:` block (lines 11-16) with the following (keep the surrounding intro, Memory, Actions, and Style sections unchanged):

```ts
Core behaviour — be resourceful before you give up:
- For ANY question about the workspace's data, documents, metrics, records, files, or connected sources, you MUST ground your answer in tools. Never answer such questions from memory or assumption.
- Work the problem like a diligent analyst, not a single lookup. Follow this loop:
  1. If the question is concrete, call ask_workspace_knowledge directly.
  2. If it is vague, time-relative ("next 5 days", "this week", "upcoming"), or the tool result comes back with weak=true or empty, call list_workspace_sources to see what is actually indexed.
  3. Reformulate using what you learned — translate relative dates to the explicit range given in the date note, and target the most likely source — then call ask_workspace_knowledge again.
  4. Only after you have genuinely exhausted these angles, tell the user you couldn't find it — and name what you DID find ("I see a 60-post content calendar and a research brief, but neither covers X"). Never give a generic "connect a document".
- Treat tool output as the source of truth and always cite the sources it returns. Prior conversation is context; if it conflicts with a tool result, the tool wins.
- Never fabricate numbers, names, quotes, or facts.
- If a question is genuinely general (not about this workspace's data), you may answer directly, but say you are answering generally.`;
```

- [ ] **Step 7: Type-check and run the unit suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: PASS (including the new `date-note.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add src/mastra/context/date-note.ts src/mastra/context/__tests__/date-note.test.ts src/app/api/agent/route.ts src/mastra/agents/supervisor-agent.ts
git commit -m "feat(agent): deliberate retrieval loop — discover, reformulate, retry"
```

---

### Task 4: Live regression verification (the "next 5 days" scenario)

Prove the original failure is fixed end-to-end, against the local UltraMem + model. This is manual/live (matches the repo's `*.live.test.ts` convention — these touch real services and are not part of `npm test`).

**Files:**
- Create: `docs/superpowers/verification/2026-06-17-agentic-retrieval-loop.md`

**Interfaces:**
- Consumes: running app (`npm run dev`), local UltraMem (`http://localhost:8080`) with `instagram-60-post-calendar.csv` indexed in the test workspace.

- [ ] **Step 1: Ensure preconditions**

Confirm UltraMem is up and the calendar is indexed:

Run: `curl -s http://localhost:8080/v1/health`
Expected: `{"ok":true}` (or the service's healthy response).

In the test workspace, confirm `instagram-60-post-calendar.csv` appears in Files/sources. If not, index it via the app's ingestion flow first.

- [ ] **Step 2: Run the regression prompt (no @-reference)**

Start the app: `npm run dev`. In a **new** chat in the test workspace, send verbatim:

> what is the content for the next 5 days?

- [ ] **Step 3: Verify the outcome**

Expected:
- The agent calls `list_workspace_sources` and/or a reformulated `ask_workspace_knowledge` (visible in server logs / network), not a single failed lookup.
- The final answer lists the dated calendar rows for the 5 days from today — WITHOUT the user naming the file.
- It does NOT respond "the workspace does not contain any indexed information".

- [ ] **Step 4: Verify the honest-not-found path**

In a new chat, ask for something truly absent:

> what is our 2027 hiring budget by department?

Expected: an honest not-found that **names what it did find** (e.g. the calendar and brief), not a generic "connect a document".

- [ ] **Step 5: Record results**

Create `docs/superpowers/verification/2026-06-17-agentic-retrieval-loop.md` documenting: the two prompts, the actual responses (paste them), whether each matched the expected outcome, and any score-floor tuning needed (`WEAK_SCORE_FLOOR` in `relevance.ts`).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/verification/2026-06-17-agentic-retrieval-loop.md
git commit -m "docs: verification of agentic retrieval loop regression scenario"
```

---

## Out of scope (follow-on plan)

**Richer collapsible thinking-trace UI** — streaming the loop's intermediate steps (tool calls + rationale) into a collapsible panel in the agent shell. This is a separate frontend subsystem with visual testing; it depends on this backend loop emitting steps first. To be planned separately once Task 4 confirms the loop behaves.

## Self-Review Notes

- **Spec coverage:** discovery tool (Task 2), honest scores/weak signal (Task 1), looped instructions + date (Task 3), regression scenario (Task 4), anti-hallucination preserved (Global Constraints + untouched synthesis prompt). UI trace explicitly deferred. ✔
- **Type consistency:** `snippets: { text: string; score: number }[]` updated at definition (Task 1 Step 5) and both consumers (Step 6 content-query, Step 6 memory-tools). `ContentAnswer.weak` → `UnifiedAnswer.weak` → tool `weak` threaded in Steps 7-9. `toSourceCatalog` signature identical in test and impl. ✔
- **No placeholders:** every code step shows complete code; every run step shows the command + expected result. ✔
