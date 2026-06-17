# Slice 1 — Agent Shell Foundation (Design)

**Date:** 2026-06-15
**Status:** Design — pending review
**Parent roadmaps:** `docs/CHAT_FIRST_AGENTIC_INTERFACE_FEATURE_ROADMAP.md`, `docs/MASTRA_ULTRAMEM_COMPANY_OPERATING_SYSTEM.md`
**Covers:** Roadmap Build Groups 1–3 foundation (Chat shell + Mastra runtime, Artifact/Canvas scaffold) plus the local UltraMem stack and the knowledge-tool bridge needed to make the agent answer from real data.

---

## 1. Goal of this slice

Deliver a **clickable, polished, chat-first workspace** where a user lands in an agent conversation (not an app grid), asks a question, and watches the agent **stream real answers grounded in the existing knowledge layer**, with run-steps shown inline and a right-side **canvas** that opens for artifacts/sources. UltraMem runs locally and is reachable from the server. This proves the spine:

```
conversation -> Mastra agent -> knowledge tool -> streamed cited answer -> canvas
```

Everything else in the roadmap (mentions, approvals, automations, suggestions, memory governance, multi-model registry) hangs off this spine and is built in later slices.

### Explicitly NOT in this slice
@-mention menu, approvals, automations, suggestions surface, memory candidate review UI, multi-provider registry UI, evals. Stubs/seams are left where these attach, but they are separate slices.

---

## 2. Architecture decisions (locked)

1. **Mastra is the agent runtime.** New `/api/agent` streaming endpoint. OpenClaw Gateway stays physically present for now (legacy `/messages` etc.) but the new chat-first surface has **zero** Gateway dependency. Gateway deletion is a later slice (roadmap Migration Phase 8).
2. **Dedicated `agent_*` tables** (not extending `chat_sessions`/`chat_messages`). Legacy chat tables remain untouched.
3. **Knowledge layer is reused, wrapped as Mastra tools.** `src/lib/knowledge/*` (`runUnifiedQuery`, sql/vector dig) is called by a thin `askWorkspaceKnowledge` tool. No knowledge logic is rewritten in this slice.
4. **Models:** Auto/Fast/Deep profiles backed by existing Fireworks + Vercel AI Gateway. `Fast` = `gpt-oss-120b` (Fireworks), `Deep` = `kimi-k2p5` (Fireworks), `Auto` routes Fast for classification/short, Deep for synthesis. A `model_profiles` registry table is created but no new provider keys are required.
5. **UltraMem** runs via local `docker compose` (Qdrant + Rust server on :8080). 500Claw talks to it **only server-side** through a typed client; `container_tag` is always derived server-side from auth context, never from the model. In this slice UltraMem is wired as a typed client + one read path (profile injection seam); full memory tooling/governance is a later slice.
6. **Security boundary unchanged:** Supabase RLS + explicit server-side workspace/user checks. Mastra tools read `userId`/`workspaceId` from request context, never from model args.

---

## 3. Data model (new migration)

New tables, workspace-scoped, RLS via existing `get_user_workspace_ids()` pattern:

```
agent_threads
  id, workspace_id, user_id, title, type ('private_ai' default), pinned,
  last_message_at, created_at, updated_at, archived

agent_messages
  id, thread_id, workspace_id, role ('user'|'assistant'|'system'),
  content (text), parts (jsonb: tool steps, citations, artifact refs),
  run_id (nullable fk), created_at

agent_runs
  id, thread_id, workspace_id, user_id, status ('running'|'done'|'error'),
  input, model_profile, model_used, cost (nullable), trace_id,
  started_at, finished_at, error

agent_steps
  id, run_id, workspace_id, step_index, type ('tool'|'reasoning'|'message'),
  name, input (jsonb), output (jsonb), error, started_at, finished_at

agent_artifacts
  id, workspace_id, thread_id, run_id, type
  ('report'|'document'|'chart'|'table'|'source_trace'|'email'|'workflow'|'approval'|'memory_candidate'),
  title, content (jsonb), metadata (jsonb), status, created_by, created_at, updated_at
```

`agent_artifacts` is created with the full type enum now so later slices add behaviour without a migration. Only `chart`/`table`/`source_trace`/`document`/`report` are *produced* in this slice.

---

## 4. Component architecture

New `src/components/agent-shell/` (per roadmap §4.1), built on existing primitives (`@base-ui/react`, tailwind v4, lucide), adopting recally's radius/spacing/motion scale:

```
agent-shell/
  agent-workspace-shell.tsx   3-zone layout: thread rail | chat surface | canvas
  agent-thread-rail.tsx       New chat, search, recent/pinned threads, (Automations/Sources stubs)
  agent-chat-surface.tsx      thread header, message stream, empty state, composer mount
  agent-empty-state.tsx       "What should we work on?" + composer + connect-source cards
  agent-message-list.tsx      streamed messages
  agent-message.tsx           user/assistant bubble, markdown via Streamdown, citation chips
  agent-run-steps.tsx         collapsible "Worked for Ns" tool/step group (Codex-style)
  agent-composer.tsx          rounded composer, model selector (Auto/Fast/Deep), send; @-seam
  agent-canvas-panel.tsx      right panel: closed by default; Analysis + Sources tabs
  artifacts/
    artifact-canvas.tsx       switches on artifact type
    source-trace-artifact.tsx citations/SQL/source inspector (the one rich artifact this slice)
    chart-artifact.tsx        recharts wrapper (knowledge layer already returns chart specs)
```

Route: new `src/app/[workspaceSlug]/agent/` (and we make the workspace root redirect/land here behind a flag, so the legacy apps stay reachable during transition). Visual language matches the Codex screenshots: light, monochrome, Inter, generous whitespace, subtle 1px borders + soft shadows.

State: a client `AgentThreadProvider` holds active thread, streaming run, canvas open/target. Streaming consumed from `/api/agent` (SSE/streamed response via Mastra), persisted to `agent_messages`/`agent_runs`/`agent_steps`.

---

## 5. Server / runtime

```
src/mastra/
  index.ts                 Mastra instance
  agents/supervisor-agent.ts
  tools/knowledge-tools.ts askWorkspaceKnowledge (wraps runUnifiedQuery), source-trace shaping
  context/request-context.ts  { userId, workspaceId, slug, role, traceId } from auth
  model/registry.ts        Auto/Fast/Deep -> Fireworks/Gateway model resolution

src/lib/memory/
  ultramem-client.ts       typed client (add/search/profile/timeline/health), server-only
  scopes.ts                container_tag builders (workspace:{id}:user:{id}, etc.)

src/app/api/agent/route.ts   POST: auth -> build context -> run supervisor -> stream
                             -> persist run/steps/messages; GET: thread history
```

Tool pattern (roadmap §21.2): read context → validate workspace/user → validate input → call server fn → return compact result + citations → log step. `askWorkspaceKnowledge` returns `{ markdown, citations[], sql?, chart? }`; chart/source-trace become artifacts.

---

## 6. Auth toggle for testing

Add `AGENT_DEV_NO_AUTH=true` (dev-only, default off). When set, middleware + `/api/agent` resolve a fixed seed user/workspace instead of redirecting to Google login, enabling Playwright runs without OAuth. **Re-enabled (flag removed/off) before the slice is called done.** Never honoured in production builds.

---

## 7. UltraMem local stack

`docker compose up` in `/Users/davak/Documents/ultramem` (Qdrant :6333 + server :8080). 500Claw env gets `ULTRAMEM_API_URL=http://localhost:8080` and `ULTRAMEM_API_KEY`. `ultramem-client.ts` verifies `/v1/health` on boot. The `ultramem-mcp` stdio server is available for Mastra/agent tool use in a later memory slice; this slice only needs the HTTP client.

---

## 8. Done criteria for Slice 1

- `docker compose` UltraMem stack healthy; `/v1/health` returns ok; client reaches it from the app.
- User lands in chat-first shell at the workspace; "What should we work on?" empty state renders, polished, matching the Codex aesthetic.
- Sending a message creates a thread, calls `/api/agent`, streams a **real knowledge-grounded answer**, shows collapsible run-steps, and persists to `agent_*` tables.
- A data/answer with citations opens the right canvas (source-trace) and a chart renders when the knowledge layer returns one.
- New chat surface has **no** `useGateway`/Gateway dependency.
- Auth flag verified working for tests, then turned back on.
- Typecheck + existing tests pass; Playwright smoke of the core loop passes.

---

## 9. Build order within the slice

1. UltraMem up + `ultramem-client` + health check.
2. Migration for `agent_*` tables + generated types.
3. Mastra install + supervisor agent + `askWorkspaceKnowledge` tool + `/api/agent` streaming.
4. Agent-shell UI (layout → thread rail → chat surface → composer → empty state).
5. Run-steps + streaming wiring + persistence.
6. Canvas panel + source-trace + chart artifact.
7. Auth dev flag + Playwright smoke; polish pass; re-enable auth.

Later slices (separate specs): @-mentions & capability registry · approvals · report/document artifacts & tools · UltraMem memory tooling + Memory Center · automations · suggestions · Gateway removal · evals.
