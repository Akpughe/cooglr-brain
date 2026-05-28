// Live FULL end-to-end against a real Postgres database AND the real Fireworks
// model. Skipped unless both KNOWLEDGE_TEST_DB_URL and FIREWORKS_API_KEY are set.
// The connection string is read from env — never hardcoded/committed.
//
//   set -a; . ./.env.local; set +a
//   KNOWLEDGE_TEST_DB_URL=postgres://... npx vitest run db-e2e.live
import { describe, it, expect } from "vitest";
import { createPostgresAdapter } from "../../db-adapter";
import { buildPages } from "../ingest";
import { planQuery, synthesizeAnswer } from "../query";
import { guardReadOnlySql } from "../sql-guard";
import { sqlDigTool } from "../dig/sql-dig";
import type { RawTable } from "../introspect";

const url = process.env.KNOWLEDGE_TEST_DB_URL;
const hasKey = Boolean(process.env.FIREWORKS_API_KEY);

describe.skipIf(!url || !hasKey)("knowledge layer — live DB + Fireworks e2e", () => {
  it("introspects a real DB, plans, digs live read-only, and synthesizes", { timeout: 180000 }, async () => {
    const adapter = await createPostgresAdapter(url!);

    // 1. Real structural introspection.
    const intro = await adapter.introspect();
    console.log(`INTROSPECT: ${intro.tables.length} tables in public schema`);
    console.log("SAMPLE TABLES:", intro.tables.slice(0, 8).map((t) => `${t.name}(${t.columns.length}c,~${t.rowCount}r)`).join(", "));
    expect(intro.tables.length).toBeGreaterThan(0);

    // Bound the map we feed the planner (keep the prompt small for the test).
    const raw: RawTable[] = intro.tables.slice(0, 25);

    // 2. Build the structural map from the REAL schema (no enrichment call here).
    const pages = buildPages("ws-live", "conn-live", raw, { tables: [], metrics: [] });
    const indexLines = pages.map((p) => `- ${p.path} — ${p.title}`).join("\n");
    const pageSpecs = JSON.stringify(
      pages.filter((p) => p.type === "table").map((p) => ({ path: p.path, accessSpec: p.accessSpec })),
    );

    // 3. Ask a question guaranteed answerable: a row count on a real table.
    const target = raw[0].name;
    const question = `How many rows are in the "${target}" table?`;
    const plan = await planQuery(question, indexLines, pageSpecs);
    console.log("PLANNED SQL:", plan.sql);
    expect(plan.sql.toLowerCase()).toMatch(/^\s*(select|with)\b/);

    // 4. Guard + dig LIVE against the real read-only connection.
    guardReadOnlySql(plan.sql, { maxRows: 100 }); // throws if unsafe
    const dig = await sqlDigTool.run(plan, {
      connectionId: "conn-live",
      maxRows: 100,
      query: (sql) => adapter.runReadOnly(sql),
    });
    console.log("DIG ROWS:", JSON.stringify(dig.rows).slice(0, 300));
    expect(dig.rowCount).toBeGreaterThanOrEqual(0);

    // 5. Synthesize from the real rows.
    const answer = await synthesizeAnswer(question, plan, dig);
    console.log("ANSWER:", answer.answerMd);
    expect(answer.answerMd.length).toBeGreaterThan(0);

    await adapter.close();
  });
});
