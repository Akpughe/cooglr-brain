# Knowledge Layer — DB-Structural Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a synthesis-at-ingest knowledge map of a connected database, and a Plan → Dig → Synthesize query flow that answers questions by reading the map then running read-only SQL live.

**Architecture:** Introspect a `database_connections` row into a structural map stored as Supabase rows (`knowledge_*` tables, RLS-scoped). An LLM enriches the raw schema into semantic pages with machine-readable `access_spec`. Queries read the map (the index + relevant pages), generate SQL grounded by `access_spec`, run it through a hard read-only guard, and synthesize an answer. The "dig" step is a pluggable interface (SQL only in v1) and the loop is agentic-ready, so RAG/keyword/API tools drop in later without a refactor.

**Tech Stack:** Next.js 16 (route handlers), Supabase (Postgres + RLS), `pg` (existing `db-adapter`), OpenClaw Gateway / Gemini for LLM, Recharts (existing), vitest (new, for tests).

**Spec:** `docs/superpowers/specs/2026-05-28-knowledge-layer-db-structural-design.md`

---

## File Structure

**New files**
- `supabase/migrations/018_knowledge_layer.sql` — the 6 knowledge tables + RLS.
- `src/lib/knowledge/types.ts` — shared TypeScript types (pages, access_spec, plan, dig).
- `src/lib/knowledge/sql-guard.ts` — read-only SQL guard (pure, security-critical).
- `src/lib/knowledge/introspect.ts` — rich DB introspection + relationship inference (pure logic + adapter glue).
- `src/lib/knowledge/agents-md.ts` — the default per-workspace schema/policy doc.
- `src/lib/knowledge/llm.ts` — thin LLM helper (structured completion), swappable gateway/Gemini.
- `src/lib/knowledge/ingest.ts` — orchestration: introspect → enrich → pages → index → persist.
- `src/lib/knowledge/dig/types.ts` — `DigTool` contract (the RAG-ready seam).
- `src/lib/knowledge/dig/sql-dig.ts` — the SQL dig tool (uses sql-guard + db-adapter).
- `src/lib/knowledge/dig/registry.ts` — dig-tool registry (only sql in v1).
- `src/lib/knowledge/query.ts` — orchestration: plan → dig → synthesize.
- `src/app/api/knowledge/ingest/route.ts` — POST: build/refresh map for a connection (SSE progress).
- `src/app/api/knowledge/query/route.ts` — POST: ask a question (SSE: plan, sql, answer).
- `src/app/api/knowledge/pages/route.ts` — GET: list/read map pages for a connection.
- `src/app/[workspaceSlug]/knowledge/page.tsx` — minimal Knowledge view.
- `src/components/knowledge/knowledge-view.tsx` — client component: connection picker, build button, page browser, ask box.
- Test files under `src/lib/knowledge/__tests__/`.

**Modified files**
- `src/lib/db-adapter.ts` — add `introspect()` returning rich schema (PK/FK/indexes/stats) and a `runReadOnly(sql)` that the SQL dig tool calls.
- `package.json` — add vitest + test script.
- `src/lib/apps/registry.ts` — add a `knowledge` app manifest (built_in, hasSidebar false initially or a simple route).

---

## Phase 1 — Foundation (test infra, types, guard, introspection, migration)

### Task 1: Add vitest test runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `npm i -D vitest@^3`
Expected: added to devDependencies.

- [ ] **Step 2: Add test script to package.json**

In `package.json` `scripts`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
```

- [ ] **Step 4: Verify the runner works**

Create `src/lib/knowledge/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => expect(1 + 1).toBe(2)); });
```
Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/knowledge/__tests__/smoke.test.ts
git commit -m "chore: add vitest test runner"
```

---

### Task 2: Core types

**Files:**
- Create: `src/lib/knowledge/types.ts`

- [ ] **Step 1: Write the types**

```ts
// Page types in the knowledge map
export type KnowledgePageType =
  | "database" | "table" | "relationship" | "metric" | "domain";

// A column as introspected + enriched
export interface ColumnSpec {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  description?: string;        // LLM-enriched
  sampleValues?: string[];     // low-cardinality only
}

// A foreign-key or inferred join path
export interface JoinPath {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  declared: boolean;           // true = real FK, false = name-heuristic
}

// The machine-readable half of a page — what makes a dig precise
export interface AccessSpec {
  connectionId: string;
  table?: string;
  grain?: string;              // what one row represents
  columns?: ColumnSpec[];
  joins?: JoinPath[];
  metricSql?: string;          // for metric pages: vetted SQL
  tenantColumn?: string;       // scoping column if any
}

export interface KnowledgePage {
  id?: string;
  workspaceId: string;
  connectionId: string;
  path: string;                // e.g. db/<conn>/tables/users
  type: KnowledgePageType;
  title: string;
  contentMd: string;
  frontmatter: Record<string, unknown>;
  accessSpec: AccessSpec;
  confidence: "low" | "medium" | "high";
  stale: boolean;
}

// Result of the Plan step
export interface QueryPlan {
  question: string;
  pagePaths: string[];         // map pages the planner used
  tables: string[];
  joinPath?: JoinPath[];
  sql: string;                 // grounded SQL to run
  wantsChart: boolean;
  chartHint?: "bar" | "line" | "pie";
}

// Result of a Dig
export interface DigResult {
  tool: string;                // e.g. "sql"
  sql?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/knowledge/types.ts
git commit -m "feat: knowledge layer core types"
```

---

### Task 3: Read-only SQL guard (security-critical, TDD)

**Files:**
- Create: `src/lib/knowledge/sql-guard.ts`
- Test: `src/lib/knowledge/__tests__/sql-guard.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { guardReadOnlySql, GuardError } from "../sql-guard";

describe("guardReadOnlySql", () => {
  it("allows a simple SELECT and injects a LIMIT", () => {
    const out = guardReadOnlySql("SELECT id FROM users", { maxRows: 1000 });
    expect(out.toLowerCase()).toContain("select id from users");
    expect(out.toLowerCase()).toContain("limit 1000");
  });

  it("allows a CTE (WITH ... SELECT)", () => {
    const out = guardReadOnlySql("WITH x AS (SELECT 1 a) SELECT a FROM x", { maxRows: 10 });
    expect(out.toLowerCase()).toContain("with x as");
  });

  it("preserves an existing LIMIT under the cap", () => {
    const out = guardReadOnlySql("SELECT 1 LIMIT 5", { maxRows: 1000 });
    expect(out.toLowerCase()).toContain("limit 5");
  });

  it("rejects INSERT", () => {
    expect(() => guardReadOnlySql("INSERT INTO users VALUES (1)", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects UPDATE", () => {
    expect(() => guardReadOnlySql("UPDATE users SET x=1", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects DELETE", () => {
    expect(() => guardReadOnlySql("DELETE FROM users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects DROP / DDL", () => {
    expect(() => guardReadOnlySql("DROP TABLE users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects multiple statements", () => {
    expect(() => guardReadOnlySql("SELECT 1; DELETE FROM users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects a trailing-comment write smuggle", () => {
    expect(() => guardReadOnlySql("SELECT 1; -- ok\nDROP TABLE users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects writes hidden after a block comment", () => {
    expect(() => guardReadOnlySql("/* note */ UPDATE users SET x=1", { maxRows: 10 })).toThrow(GuardError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- sql-guard`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the guard**

```ts
export class GuardError extends Error {
  constructor(message: string) { super(message); this.name = "GuardError"; }
}

const FORBIDDEN = [
  "insert", "update", "delete", "drop", "alter", "create", "truncate",
  "grant", "revoke", "comment", "merge", "call", "do", "copy",
  "vacuum", "analyze", "reindex", "set", "reset", "lock", "begin",
  "commit", "rollback", "savepoint", "listen", "notify", "explain",
];

function stripComments(sql: string): string {
  // remove /* ... */ and -- ... line comments before keyword scanning
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

export function guardReadOnlySql(raw: string, opts: { maxRows: number }): string {
  const trimmed = raw.trim().replace(/;\s*$/, "");
  const scan = stripComments(trimmed).trim();

  if (!scan) throw new GuardError("Empty statement");

  // single statement only — no semicolons in the body
  if (scan.includes(";")) throw new GuardError("Multiple statements are not allowed");

  const lower = scan.toLowerCase();
  // must start with select or with
  if (!/^(select|with)\b/.test(lower)) {
    throw new GuardError("Only SELECT/WITH queries are allowed");
  }
  // no forbidden keyword anywhere (word-boundary)
  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(scan)) {
      throw new GuardError(`Forbidden keyword: ${kw}`);
    }
  }

  // enforce a LIMIT — wrap so an existing LIMIT under cap is preserved,
  // and any query without one is capped.
  if (/\blimit\s+\d+/i.test(lower)) {
    const m = lower.match(/\blimit\s+(\d+)/);
    const n = m ? parseInt(m[1], 10) : opts.maxRows;
    if (n <= opts.maxRows) return trimmed;
  }
  return `SELECT * FROM (${trimmed}) AS _guarded LIMIT ${opts.maxRows}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- sql-guard`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/sql-guard.ts src/lib/knowledge/__tests__/sql-guard.test.ts
git commit -m "feat: read-only SQL guard with tests"
```

---

### Task 4: Relationship inference (pure, TDD)

**Files:**
- Create: `src/lib/knowledge/introspect.ts` (the pure `inferJoins` function first)
- Test: `src/lib/knowledge/__tests__/infer-joins.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { inferJoins, type RawTable } from "../introspect";

const tables: RawTable[] = [
  { name: "users", columns: [{ name: "id", type: "uuid", nullable: false, isPrimaryKey: true }], foreignKeys: [] },
  { name: "orders", columns: [
      { name: "id", type: "uuid", nullable: false, isPrimaryKey: true },
      { name: "user_id", type: "uuid", nullable: false, isPrimaryKey: false },
    ], foreignKeys: [] },
];

describe("inferJoins", () => {
  it("infers orders.user_id -> users.id by name heuristic", () => {
    const joins = inferJoins(tables);
    expect(joins).toContainEqual({
      fromTable: "orders", fromColumn: "user_id",
      toTable: "users", toColumn: "id", declared: false,
    });
  });

  it("prefers a declared FK over a heuristic", () => {
    const withFk: RawTable[] = [
      tables[0],
      { ...tables[1], foreignKeys: [{ column: "user_id", refTable: "users", refColumn: "id" }] },
    ];
    const joins = inferJoins(withFk);
    const j = joins.find((x) => x.fromTable === "orders" && x.fromColumn === "user_id");
    expect(j?.declared).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- infer-joins`
Expected: FAIL (module/function not found).

- [ ] **Step 3: Implement `inferJoins` + raw types in introspect.ts**

```ts
import type { JoinPath } from "./types";

export interface RawColumn { name: string; type: string; nullable: boolean; isPrimaryKey: boolean; }
export interface RawForeignKey { column: string; refTable: string; refColumn: string; }
export interface RawTable { name: string; columns: RawColumn[]; foreignKeys: RawForeignKey[]; }

// Heuristic: a column named `<singular>_id` joins to table `<plural>`.id
export function inferJoins(tables: RawTable[]): JoinPath[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const out: JoinPath[] = [];

  for (const t of tables) {
    // declared FKs first
    for (const fk of t.foreignKeys) {
      out.push({ fromTable: t.name, fromColumn: fk.column, toTable: fk.refTable, toColumn: fk.refColumn, declared: true });
    }
    // name heuristics for columns not already covered by a declared FK
    const declaredCols = new Set(t.foreignKeys.map((f) => f.column));
    for (const c of t.columns) {
      if (declaredCols.has(c.name)) continue;
      const m = c.name.match(/^(.*)_id$/);
      if (!m) continue;
      const base = m[1];
      const candidates = [base, `${base}s`, `${base}es`];
      const target = candidates.map((n) => byName.get(n)).find(Boolean);
      if (!target) continue;
      const pk = target.columns.find((x) => x.isPrimaryKey) ?? target.columns.find((x) => x.name === "id");
      if (!pk) continue;
      out.push({ fromTable: t.name, fromColumn: c.name, toTable: target.name, toColumn: pk.name, declared: false });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- infer-joins`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/introspect.ts src/lib/knowledge/__tests__/infer-joins.test.ts
git commit -m "feat: relationship inference (declared FK + name heuristic) with tests"
```

---

### Task 5: Rich introspection in db-adapter

**Files:**
- Modify: `src/lib/db-adapter.ts`
- Modify: `src/lib/knowledge/introspect.ts` (add `introspectConnection`)

- [ ] **Step 1: Add `introspect()` + `runReadOnly()` to the Postgres adapter**

In `db-adapter.ts`, extend the `DbAdapter` interface:
```ts
export interface RawIntrospection {
  tables: { name: string; columns: { name: string; type: string; nullable: boolean; isPrimaryKey: boolean }[];
            foreignKeys: { column: string; refTable: string; refColumn: string }[]; rowCount: number }[];
}
export interface DbAdapter {
  testConnection(): Promise<void>;
  listDatabases(): Promise<string[]>;
  getSchema(): Promise<SchemaTable[]>;
  introspect(): Promise<RawIntrospection>;     // NEW
  query(sql: string): Promise<QueryResult>;
  close(): Promise<void>;
}
```

In `createPostgresAdapter`, add the `introspect` method using `information_schema` + `pg_constraint` for PK/FK and `reltuples` for row estimates:
```ts
async introspect(): Promise<RawIntrospection> {
  const cols = await client!.query(`
    SELECT c.table_name, c.column_name, c.data_type, c.is_nullable,
      (pk.column_name IS NOT NULL) AS is_pk
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema='public'
    ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
    WHERE c.table_schema='public'
    ORDER BY c.table_name, c.ordinal_position
  `);
  const fks = await client!.query(`
    SELECT tc.table_name, kcu.column_name,
      ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
  `);
  const counts = await client!.query(`
    SELECT relname AS table_name, reltuples::bigint AS approx
    FROM pg_class WHERE relkind='r'
  `);
  const tableMap = new Map<string, RawIntrospection["tables"][number]>();
  for (const r of cols.rows) {
    if (!tableMap.has(r.table_name)) tableMap.set(r.table_name, { name: r.table_name, columns: [], foreignKeys: [], rowCount: 0 });
    tableMap.get(r.table_name)!.columns.push({
      name: r.column_name, type: r.data_type, nullable: r.is_nullable === "YES", isPrimaryKey: r.is_pk,
    });
  }
  for (const r of fks.rows) tableMap.get(r.table_name)?.foreignKeys.push({ column: r.column_name, refTable: r.ref_table, refColumn: r.ref_column });
  for (const r of counts.rows) { const t = tableMap.get(r.table_name); if (t) t.rowCount = Number(r.approx); }
  return { tables: [...tableMap.values()] };
}
```

(ClickHouse adapter: add an `introspect()` that returns `{ tables: [] }` for now — out of scope; Postgres is the v1 target.)

- [ ] **Step 2: Add `introspectConnection` to introspect.ts**

```ts
import type { AccessSpec } from "./types";
// builds the inferred join graph + per-table access specs from a live connection
export function buildAccessSpecs(connectionId: string, raw: RawTable[]) {
  const joins = inferJoins(raw);
  return raw.map((t): AccessSpec => ({
    connectionId,
    table: t.name,
    columns: t.columns.map((c) => ({ ...c })),
    joins: joins.filter((j) => j.fromTable === t.name || j.toTable === t.name),
  }));
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db-adapter.ts src/lib/knowledge/introspect.ts
git commit -m "feat: rich Postgres introspection (PK/FK/rowcount) + access-spec builder"
```

---

### Task 6: Migration 018 — knowledge tables + RLS

**Files:**
- Create: `supabase/migrations/018_knowledge_layer.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Migration 018: Knowledge layer — DB-structural map
-- ============================================================

create table public.knowledge_pages (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  connection_id uuid references public.database_connections(id) on delete cascade not null,
  path text not null,
  type text not null check (type in ('database','table','relationship','metric','domain')),
  title text not null,
  content_md text not null default '',
  frontmatter jsonb not null default '{}',
  access_spec jsonb not null default '{}',
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  stale boolean not null default false,
  updated_at timestamptz default now(),
  unique (workspace_id, path)
);
alter table public.knowledge_pages enable row level security;
create policy "members read pages" on public.knowledge_pages for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write pages" on public.knowledge_pages for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));
create index idx_knowledge_pages_conn on public.knowledge_pages(connection_id);

create table public.knowledge_page_revisions (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references public.knowledge_pages(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  content_md text not null,
  frontmatter jsonb not null default '{}',
  access_spec jsonb not null default '{}',
  operation text not null check (operation in ('ingest','refresh','manual')),
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.knowledge_page_revisions enable row level security;
create policy "members read revisions" on public.knowledge_page_revisions for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write revisions" on public.knowledge_page_revisions for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create table public.knowledge_index (
  page_id uuid references public.knowledge_pages(id) on delete cascade primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  summary_1line text not null,
  categories text[] not null default '{}',
  last_touched timestamptz default now()
);
alter table public.knowledge_index enable row level security;
create policy "members read index" on public.knowledge_index for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write index" on public.knowledge_index for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

create table public.knowledge_agents_md (
  workspace_id uuid references public.workspaces(id) on delete cascade primary key,
  content text not null,
  updated_at timestamptz default now()
);
alter table public.knowledge_agents_md enable row level security;
create policy "members read agents_md" on public.knowledge_agents_md for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "owners write agents_md" on public.knowledge_agents_md for all to authenticated
  using (workspace_id in (select public.get_user_owned_workspace_ids()))
  with check (workspace_id in (select public.get_user_owned_workspace_ids()));

create table public.knowledge_jobs (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  connection_id uuid references public.database_connections(id) on delete cascade not null,
  kind text not null check (kind in ('ingest','refresh')),
  status text not null default 'queued' check (status in ('queued','running','done','error')),
  logs jsonb not null default '[]',
  error text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  finished_at timestamptz
);
alter table public.knowledge_jobs enable row level security;
create policy "members read jobs" on public.knowledge_jobs for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write jobs" on public.knowledge_jobs for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

create table public.knowledge_query_log (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  question text not null,
  plan jsonb,
  sql_executed text,
  row_count int,
  answer_md text,
  citations jsonb,
  conversation_id uuid,
  created_at timestamptz default now()
);
alter table public.knowledge_query_log enable row level security;
create policy "members read query log" on public.knowledge_query_log for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write query log" on public.knowledge_query_log for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));
```

- [ ] **Step 2: Apply via Supabase MCP / CLI**

Apply through the Supabase MCP `apply_migration` (name `018_knowledge_layer`) or `supabase db push`. Verify the 6 tables exist with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/018_knowledge_layer.sql
git commit -m "feat: migration 018 — knowledge layer tables + RLS"
```

---

### Task 7: Default AGENTS.md seed

**Files:**
- Create: `src/lib/knowledge/agents-md.ts`

- [ ] **Step 1: Write the default schema doc**

```ts
export const DEFAULT_AGENTS_MD = `# Knowledge Wiki Schema (DB-structural map)

You maintain a structural map of a connected database. The map is a navigator, not a data store.

## Page types
- database: one overview page for the connection
- table: one per table; carries an access_spec (columns, types, keys, joins)
- relationship: a join path between tables
- metric: a named business metric with vetted read-only SQL
- domain: a synthesis grouping related tables (e.g. "Billing")

## Rules
1. access_spec must use REAL table/column names from introspection — never invent.
2. Every metric's SQL must be a single read-only SELECT/WITH.
3. Mark inferred (non-FK) joins as confidence: medium.
4. Structural changes refresh pages; data changes never do.

## Query workflow: Plan -> Dig -> Synthesize
1. Plan: read the index + relevant pages; produce tables, join path, and grounded SQL.
2. Dig: run the SQL live, read-only.
3. Synthesize: answer from the rows; cite the pages used and show the SQL.
`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/knowledge/agents-md.ts
git commit -m "feat: default knowledge AGENTS.md seed"
```

---

## Phase 2 — Ingest pipeline

### Task 8: LLM helper

**Files:**
- Create: `src/lib/knowledge/llm.ts`

- [ ] **Step 1: Implement a structured-completion helper**

Mirror `src/app/api/reports/analyze/route.ts`'s Gemini usage (runnable today), behind a single function so it can be swapped to the OpenClaw Gateway later.
```ts
// Returns the model's text. JSON parsing is the caller's job.
export async function complete(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("AI key not configured (GEMINI_API_KEY)");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${system}\n\n${user}` }] }] }) },
  );
  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{"); const startArr = cleaned.indexOf("[");
  const i = start === -1 ? startArr : (startArr === -1 ? start : Math.min(start, startArr));
  return JSON.parse(cleaned.slice(i)) as T;
}
```

- [ ] **Step 2: Test `extractJson` (TDD, pure part)**

`src/lib/knowledge/__tests__/extract-json.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractJson } from "../llm";
it("strips fences and parses", () => {
  expect(extractJson<{a:number}>("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
});
```
Run: `npm test -- extract-json` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/knowledge/llm.ts src/lib/knowledge/__tests__/extract-json.test.ts
git commit -m "feat: knowledge LLM helper (Gemini, swappable) + json extractor"
```

---

### Task 9: Ingest orchestration

**Files:**
- Create: `src/lib/knowledge/ingest.ts`

- [ ] **Step 1: Implement `buildPages` (pure) + `runIngest` (glue)**

`buildPages(connectionId, raw, enrichment)` turns introspection + LLM enrichment into `KnowledgePage[]` (one database page, one per table with access_spec, relationship pages from joins, metric pages from enrichment). `runIngest(supabase, { workspaceId, connectionId })`:
1. decrypt connection string (existing `src/lib/crypto.ts`), open adapter, `introspect()`.
2. `buildAccessSpecs` + `inferJoins`.
3. call `complete()` with `DEFAULT_AGENTS_MD` + the raw schema to get per-table descriptions, grain, tenant column, and proposed metrics (JSON).
4. `buildPages(...)`, upsert into `knowledge_pages`, insert `knowledge_page_revisions`, upsert `knowledge_index`.
5. update the `knowledge_jobs` row to `done`.

Show the full `buildPages` code (pure, deterministic) and the `runIngest` glue. Unit-test `buildPages` with a fixed enrichment object.

- [ ] **Step 2: Test `buildPages` (TDD)**

Assert: N tables → 1 database page + N table pages; each table page's `accessSpec.columns` matches input; a join produces a relationship page; a proposed metric produces a metric page whose `accessSpec.metricSql` is the vetted SQL.
Run: `npm test -- build-pages` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/knowledge/ingest.ts src/lib/knowledge/__tests__/build-pages.test.ts
git commit -m "feat: ingest pipeline — buildPages (tested) + runIngest glue"
```

---

## Phase 3 — Query: Plan → Dig → Synthesize

### Task 10: Dig interface + SQL dig tool (the RAG-ready seam)

**Files:**
- Create: `src/lib/knowledge/dig/types.ts`, `src/lib/knowledge/dig/sql-dig.ts`, `src/lib/knowledge/dig/registry.ts`

- [ ] **Step 1: Define the `DigTool` contract**

```ts
import type { QueryPlan, DigResult } from "../types";
export interface DigContext { connectionId: string; connectionString: string; maxRows: number; }
export interface DigTool {
  name: string;
  canHandle(plan: QueryPlan): boolean;
  run(plan: QueryPlan, ctx: DigContext): Promise<DigResult>;
}
```

- [ ] **Step 2: Implement the SQL dig tool**

Uses `guardReadOnlySql(plan.sql, { maxRows })` then the adapter's read-only `query()`; returns a `DigResult`.

- [ ] **Step 3: Registry (sql only in v1)**

```ts
import { sqlDigTool } from "./sql-dig";
import type { DigTool } from "./types";
const TOOLS: DigTool[] = [sqlDigTool];
export function pickDigTool(plan: import("../types").QueryPlan): DigTool {
  const t = TOOLS.find((x) => x.canHandle(plan));
  if (!t) throw new Error("No dig tool for this plan");
  return t;
}
```

- [ ] **Step 4: Test `canHandle` + that the SQL tool runs the guard**

Mock the adapter; assert a write SQL in the plan throws via the guard. Run: `npm test -- sql-dig` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/dig
git commit -m "feat: pluggable dig interface + SQL dig tool (RAG-ready seam)"
```

---

### Task 11: Query orchestration (plan → dig → synthesize)

**Files:**
- Create: `src/lib/knowledge/query.ts`

- [ ] **Step 1: Implement `planQuery`, then `runQuery`**

`planQuery(question, indexRows, pages)` calls `complete()` with the index + selected pages' access_specs and returns a `QueryPlan` (grounded SQL). `runQuery(supabase, { workspaceId, connectionId, question })`:
1. load `knowledge_index` + relevant `knowledge_pages`.
2. `planQuery(...)`.
3. `pickDigTool(plan).run(plan, ctx)`.
4. `complete()` to synthesize a markdown answer + optional chart spec from the rows.
5. insert `knowledge_query_log`. Return `{ plan, dig, answerMd, chart, citations }`.

- [ ] **Step 2: Test the agentic-ready loop shape**

Unit-test that `runQuery` calls plan, then dig, then synthesize in order (inject fakes); assert it stops after one iteration when the dig succeeds. Run: `npm test -- run-query` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/knowledge/query.ts src/lib/knowledge/__tests__/run-query.test.ts
git commit -m "feat: query orchestration — plan -> dig -> synthesize (agentic-ready)"
```

---

### Task 12: API routes

**Files:**
- Create: `src/app/api/knowledge/ingest/route.ts`, `query/route.ts`, `pages/route.ts`

- [ ] **Step 1: Implement the three routes** following the `src/app/api/gateway/route.ts` pattern (auth via `createClient()`, `getUser()`, workspace check). `ingest` creates a `knowledge_jobs` row and runs `runIngest`; `query` runs `runQuery` and returns the result (SSE optional in v1, JSON acceptable); `pages` lists/reads map pages for a connection.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/knowledge
git commit -m "feat: knowledge API routes — ingest, query, pages"
```

---

## Phase 4 — Minimal UI + Reports integration

### Task 13: Knowledge view + registry entry

**Files:**
- Create: `src/app/[workspaceSlug]/knowledge/page.tsx`, `src/components/knowledge/knowledge-view.tsx`
- Modify: `src/lib/apps/registry.ts`

- [ ] **Step 1: Add a `knowledge` app manifest** (built_in, route `/knowledge`, icon `Brain`).
- [ ] **Step 2: Build the minimal client view** — pick a connection, "Build map" button (calls `/api/knowledge/ingest`), a page list (`/api/knowledge/pages`), and an ask box (`/api/knowledge/query`) rendering the answer + a Recharts chart when present (reuse the Reports chart component).
- [ ] **Step 3: Build** — `npm run build` clean.
- [ ] **Step 4: Commit**

```bash
git add src/app/[workspaceSlug]/knowledge src/components/knowledge src/lib/apps/registry.ts
git commit -m "feat: minimal Knowledge view + app registry entry"
```

---

### Task 14: Re-point Reports at the knowledge engine

**Files:**
- Modify: `src/app/api/reports/analyze/route.ts` (or add a flag to prefer the knowledge query path when a map exists)

- [ ] **Step 1:** When a connection has a built map, route `analyze`/`generate` through `runQuery` so SQL is grounded by the map instead of guessed. Keep the old path as fallback when no map exists.
- [ ] **Step 2: Build + manual smoke** against a seeded DB.
- [ ] **Step 3: Commit**

```bash
git add src/app/api/reports
git commit -m "feat: Reports uses the knowledge map when available"
```

---

## Self-Review

- **Spec coverage:** data model (Task 6), AGENTS.md row (Tasks 6/7), introspection (Task 5), relationship inference (Task 4), enrichment/ingest (Tasks 8/9), plan→dig→synthesize (Tasks 10/11), read-only guard (Task 3), pluggable dig + agentic-ready (Tasks 10/11), routes (Task 12), minimal UI + Reports (Tasks 13/14), tests incl. RLS/guard/inference/golden (Tasks 3/4/9/11 + manual golden in 14). Refresh-on-schema-change: `runIngest` re-run diffs via upsert; a dedicated diff step is a fast-follow (noted).
- **Placeholders:** critical/pure tasks (guard, inference, types, migration, json-extract) carry full code; orchestration/route/UI tasks specify exact files, functions, and the existing pattern to follow.
- **Type consistency:** `AccessSpec`, `QueryPlan`, `DigResult`, `JoinPath`, `RawTable` are defined once (Tasks 2/4) and reused everywhere.

## Verification boundary (honest)

Fully verifiable now (no external services): vitest unit tests (guard, inference, json-extract, buildPages, run-query loop), `tsc --noEmit`, `npm run build`. Requires the live environment to validate end to end: actual introspection + ingest against a real Postgres connection, and the LLM enrichment/plan/synthesize calls (Gemini key, or the OpenClaw Gateway). The golden query (Task 14) and any RLS-in-database assertions need a running Supabase + a seeded DB.
