# Knowledge Layer — DB-Structural Map (Sub-Project 1 of the Understanding Layer)

**Date:** 2026-05-28
**Status:** Design — pending implementation plan
**Branch (proposed):** `feat/knowledge-layer-db`

---

## 1. Context & vision

500Claw's `PRODUCT_OVERVIEW.md` promises "AI on top of *your* data." Today that promise is the least-built part of the platform: the dashboard chat streams from the OpenClaw Gateway, and the Reports app generates SQL by guessing from a raw schema. There is no layer that actually *understands* a workspace's data.

This spec introduces that layer. It is adapted from the `meridian` project (`/Users/davak/Documents/meridian`), a synthesis-at-ingest knowledge wiki where an LLM reads a schema doc (`AGENTS.md`) and maintains a set of interconnected pages plus an index. We are rebuilding the *approach* natively in 500Claw (Next.js 16 + Supabase + OpenClaw Gateway), not running meridian's Python/git stack.

### The guiding principle: the map plans, the source digs

The knowledge layer is **not an answer store. It is a map and an access point.** It holds a deep, structural understanding of what data exists, how it is shaped, and how everything connects — and crucially, *how to reach the real thing*. It does not hold the data itself.

Every real question therefore runs in three phases:

1. **Plan** — read the map to decide what is relevant, where it lives, and exactly how to fetch it.
2. **Dig** — go to the live source and pull the actual, current data using that plan.
3. **Synthesize** — compose the answer from what was dug up, with citations to both the map and the live result.

For a database the map is the schema (tables, columns, relationships, join paths, metric definitions). It never holds rows. When a question arrives, the map tells the system *how* to query, and the system digs into the live database, runs read-only SQL, and returns today's real numbers.

This generalizes to every future source (Gmail, Drive, GitHub, Slack): the map understands structure and location; a live dig fetches the actual content. This first spec implements the principle for the database case only.

### Why this is not "just RAG"

Plain RAG (blind vector similarity over chunks) has no sense of structure or of where an answer lives. In this architecture RAG is **one of the dig tools the map routes to**, not a replacement for the map. For a database the dig tool is read-only SQL — rows are queried live, never embedded. RAG enters in the later **content-ingestion** sub-project (Drive / GitHub / Slack / Files), where it becomes an additional dig tool for sources too large to synthesize page by page. This spec does not build RAG, but it designs the seam (see §9) so RAG and an agentic multi-hop loop drop in without a refactor.

---

## 2. Scope

### In scope
- The shared knowledge-layer core: pages, revisions, a fast index, a per-workspace schema/policy doc, and async job tracking — all in Supabase, workspace-scoped, RLS-protected.
- The **DB-structural-map ingester**: introspect a connected database, infer relationships, LLM-enrich into a wiki of `database` / `table` / `relationship` / `metric` / `domain` pages.
- The **plan → dig → synthesize** query flow with a **pluggable dig interface** (SQL tool only in v1) and an **agentic-ready** loop.
- A **read-only, hard-guarded** SQL execution path.
- **Refresh on schema change.**
- A **minimal Knowledge view** to see the map and trigger (re)build, plus re-pointing the existing Reports `analyze`/`generate` endpoints at the new engine.
- Tests: RLS isolation, the SQL guard, introspection/relationship inference, and one golden end-to-end query.

### Out of scope (each its own later spec)
- Content/file ingestion (Files app, uploads) and the RAG corpus — fast-follow, reuses this core.
- Composio + non-DB sources (Gmail, Drive, GitHub, Slack, Sheets, Docs, SERP).
- Chat-as-creation-surface and "save artifact as app."
- Nightly lint / contradiction sweep.
- Any DB writes or write-approval flow (we chose read-only).

---

## 3. Data model (Supabase, workspace-scoped, RLS)

All tables carry `workspace_id` and are protected by the existing `get_user_workspace_ids()` RLS pattern (migration 013). New migration: `018_knowledge_layer.sql`.

### `knowledge_pages`
The wiki content. One row per page.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid | RLS scope |
| `connection_id` | uuid | FK → `database_connections` (the source) |
| `path` | text | e.g. `db/<connection>/tables/users` |
| `type` | text | `database` \| `table` \| `relationship` \| `metric` \| `domain` |
| `title` | text | |
| `content_md` | text | human-readable semantic doc |
| `frontmatter` | jsonb | `{ type, sources, updated, confidence, stale }` |
| `access_spec` | jsonb | **machine-readable access metadata** (see below) |
| `confidence` | text | `low` \| `medium` \| `high` |
| `stale` | boolean | default false |
| `updated_at` | timestamptz | |

Unique `(workspace_id, path)`.

`access_spec` is the half of a page that makes the dig precise. For a `table` page it holds columns + types, PK/FK, candidate join paths, low-cardinality sample values, and known filters. For a `metric` page it holds the canonical, vetted SQL. This is what the planner reads so generated SQL references real names instead of hallucinating.

### `knowledge_page_revisions`
The audit/history that git gave meridian. Full snapshot per change.

`id`, `page_id`, `workspace_id`, `content_md`, `frontmatter`, `access_spec`, `operation` (`ingest`\|`refresh`\|`manual`), `reason`, `created_by`, `created_at`.

### `knowledge_index`
The fast retrieval layer (meridian's `index.md` equivalent), read first on every query.

`page_id` pk, `workspace_id`, `summary_1line` text, `categories` text[], `last_touched` timestamptz.

### `knowledge_agents_md`
Per-workspace, editable schema/policy doc the LLM reads on **every** operation. Seeded with a default on first ingest. Teams tune their own semantics here (e.g. "`acct_id` is the tenant key", "revenue = `sum(amount) where status='paid'`").

`workspace_id` pk, `content` text, `updated_at`.

### `knowledge_jobs`
Async ingest/refresh tracking with streamed logs (same shape as the existing `chat_sessions` pattern).

`id`, `workspace_id`, `connection_id`, `kind` (`ingest`\|`refresh`), `status` (`queued`\|`running`\|`done`\|`error`), `logs` jsonb[], `error`, `created_at`, `finished_at`.

### `knowledge_query_log`
History + audit + debugging. Records the full Plan → Dig → Synthesize trace.

`id`, `workspace_id`, `user_id`, `question`, `plan` jsonb, `sql_executed` text, `row_count` int, `answer_md` text, `citations` jsonb, `conversation_id`, `created_at`.

### Reused
`database_connections` (migrations 004/010) — already workspace-scoped and AES-GCM encrypted. We recommend (but do not require) that the stored credential use a **read-only DB role**; the SQL guard (§7) is defense in depth on top of that.

---

## 4. The per-workspace schema doc (`AGENTS.md` as a row)

Stored in `knowledge_agents_md.content`, seeded with a default that defines:

- **Page types** and their purpose (`database`, `table`, `relationship`, `metric`, `domain`).
- **Required frontmatter** (`type`, `sources`, `updated`, `confidence`, `stale`).
- **The `access_spec` structure** for each page type.
- **The ingest workflow** for DB maps (§5).
- **The query workflow** — Plan → Dig → Synthesize (§6).
- **Refresh rules** — structural changes re-enrich; data changes never do.
- **Confidence model** — `high` requires corroboration; inferred (non-FK) join paths start `medium`.

The LLM reads this doc on every ingest and every query. Behavior is data, not hardcode, so a workspace can re-tune its own semantics without a deploy.

---

## 5. Ingestion: building the DB-structural map

Triggered when a database is connected in Reports, or via a "Build knowledge map" action. Runs as a `knowledge_jobs` row, streaming progress over SSE. **Every step is read-only against the source.**

1. **Introspect** (extend `src/lib/db-adapter.ts`): tables, columns, types, PK/FK, indexes, row counts, plus light statistics — distinct counts, min/max, and sample distinct values for low-cardinality columns.
2. **Infer relationships:** explicit FKs, plus heuristic join candidates by name/type (`user_id` → `users.id`), so join paths exist even where FKs were never declared. Inferred paths are marked lower-confidence.
3. **LLM enrichment** (via OpenClaw Gateway, reading `knowledge_agents_md` + the introspection output): write semantic descriptions per table and key column, state each table's grain, propose canonical metrics *with exact SQL*, name the domain entities, and flag the tenant/scoping column. Produces:
   - one `database` overview page,
   - one `table` page per table (with full `access_spec`),
   - `relationship` pages for join paths,
   - `metric` pages with vetted SQL (see §11, judgment call B),
   - optional `domain` synthesis pages ("Billing", "Users & Auth") linking related tables.
4. **Index:** write `knowledge_index` one-liners + categories for each page.
5. **Persist + revision:** upsert pages, write a `knowledge_page_revisions` snapshot per touched page, mark the job done.

Output surfaced to the UI: pages created/updated, tables mapped, metrics proposed, relationships inferred.

---

## 6. Query: Plan → Dig → Synthesize

The core loop, written so it can become agentic (multi-hop) later; v1 typically resolves in a single pass.

1. **Plan:** read `knowledge_index` + `knowledge_agents_md`; the LLM selects relevant pages, reads them in full (including `access_spec`), and emits a structured plan — tables, join path, metric SQL, filters, grouping, and whether a chart is wanted.
2. **Generate SQL** from the plan, grounded by `access_spec` so table/column names are real.
3. **Dig** via the pluggable dig interface (§9). v1 calls the **`sql` dig tool**, which runs the statement through the read-only guard (§7) and returns rows. Results cached briefly.
4. **Synthesize:** the LLM composes the answer from the actual rows, renders a Recharts chart when useful, and cites both the map pages used and the exact SQL that ran.
5. **Log** the full trace to `knowledge_query_log`.

This becomes the engine under the Reports app: `/api/reports/analyze` and `/api/reports/generate` are re-pointed here, replacing raw-schema SQL guessing with planning against an understood map.

---

## 7. Read-only guard (chosen safety boundary)

The dig step must never mutate a connected database. The `sql` dig tool enforces, in order:

1. **Parse** the statement; allow `SELECT` / `WITH` only.
2. **Reject** any write or DDL keyword, multiple statements, and comment-smuggling.
3. **Enforce** a `LIMIT` cap (injected if absent) and a statement timeout.
4. **Execute** through a read-only connection via `db-adapter`.
5. **Cache** the result for a short TTL.

Defense in depth: the stored connection credential should use a read-only DB role. The guard holds even if it does not.

---

## 8. Refresh on schema change

Re-introspect on demand or on a schedule. Diff the new introspection against each page's stored `access_spec`. Re-enrich only the pages whose structure changed (new/dropped/renamed tables or columns, changed keys), write revisions, and leave the rest untouched. **Data changes never trigger re-ingestion** — the map is structural; the live dig always reflects current values.

---

## 9. The RAG-ready seam (designed, not built)

To let RAG and other dig tools land later without a refactor:

- **Pluggable dig interface.** Define a `DigTool` contract: `{ name, canHandle(plan) → boolean, run(plan, ctx) → DigResult }`. v1 registers only `sqlDigTool`. Later sub-projects register `vectorDigTool`, `keywordDigTool`, `apiDigTool`.
- **Agentic-ready loop.** The Plan → Dig → Synthesize controller is written to support more than one dig iteration: after a dig, a synthesize-or-refine decision can loop back to plan with what was learned. v1 caps iterations at 1–2; large content sources will raise the cap for true multi-hop retrieval (map → source index → chunk → full doc).
- **Forward notes (not implemented here):** in the content sub-project, RAG also assists *ingestion* (retrieve similar existing pages to position new content, detect duplicates/contradictions), and map pages will encode *how to query RAG well* (which collection/scope to search), so retrieval is targeted rather than blind.

---

## 10. Integration points

- **New routes** under `src/app/api/knowledge/`: `ingest`, `refresh`, `query` (SSE), `pages`, `agents-md`.
- **`db-adapter.ts`** gains schema introspection + a guarded read-only execute.
- **Reports** (`/api/reports/analyze`, `/api/reports/generate`) re-point at the query engine.
- **OpenClaw Gateway** handles all LLM calls (enrichment, plan, SQL generation, synthesis), consistent with the existing chat.
- **Minimal Knowledge view** in the workspace shell (or a panel inside Reports) to browse the map, read page content, and trigger (re)build.

---

## 11. Open decisions defaulted (veto at review)

- **A — UI surface.** Defaulted to a *minimal* Knowledge view plus re-pointing Reports under the hood, so the map is visible as it builds. Alternative: no new UI in v1, purely power Reports.
- **B — Metric pages in v1.** Defaulted to *included* (LLM-proposed `metric` pages with vetted SQL), because they are high-value for grounding. Alternative: defer metrics to a fast-follow and ship table/relationship maps only.

---

## 12. Testing

- **RLS isolation:** a user in workspace A cannot read workspace B's `knowledge_pages` / index / query log. (Also begins closing the platform's current zero-tests gap.)
- **SQL guard:** rejects `INSERT`/`UPDATE`/`DELETE`/`DROP`, multiple statements, and comment-smuggling; injects/enforces `LIMIT` and timeout.
- **Introspection + relationship inference:** unit tests against a seeded test database (declared FKs and name-heuristic joins both detected).
- **Golden end-to-end:** "weekly signups" against a seeded schema → correct plan → correct SQL → correct number, with citations.

---

## 13. Build order context

This is sub-project 1 of three in the understanding-layer initiative:

1. **Knowledge layer — DB-structural map** (this spec).
2. **Composio** — connection + agent-action layer; broadens intake (Gmail, Drive, GitHub, Slack, Sheets, Docs, SERP).
3. **Chat-as-creation-surface** — ask → live artifact (report/chart) → "save as app" (a row in `app_registry` / `workspace_apps`).

Content ingestion + the RAG corpus is the natural fast-follow after sub-project 1, reusing this core and the dig seam.

### The harness (agent framework) decision — deferred to sub-project 3

The "harness" is the agentic controller that, given a question, selects the best tool at each step, decomposes hard questions, reflects on results and refines, knows when to stop, grounds every claim in a dug source, and is measured by evals. It is **sub-project 3**, built as the controller wrapped around this spec's pluggable dig-tool registry.

The framework choice is deliberately **not** made now. Candidates, to be evaluated in sub-project 3:

- **Thin custom loop** over the OpenClaw Gateway — most control, fits central audit, least lock-in, most code.
- **Vercel AI SDK** — lightweight, Vercel-native, strong tool-calling/streaming; needs gateway reconciliation.
- **Mastra** (TypeScript, sits on the AI SDK; agents, workflows, memory, RAG, evals, MCP, Studio) — most batteries, fastest to a rich agent, biggest dependency.

**Key constraint for all three:** they expect to own model routing, while 500Claw centralizes model choice, cost, and audit in the OpenClaw Gateway. Any adopted framework must either route its model calls back through the gateway (custom provider adapter) or accept losing that central control. This spec's dig interface is framework-agnostic, so the decision stays cheap and reversible.

**Principle:** the harness is only as good as the map it plans against. A harness without the knowledge layer guesses which tools to call; with the map, selection and query construction are grounded. This is why the knowledge layer is built first and the harness third.
