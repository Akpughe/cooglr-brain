// Live integration test — hits the real Fireworks model via the AI SDK.
// Skipped automatically unless FIREWORKS_API_KEY is set, so `npm test` stays
// deterministic. Run explicitly with the key loaded from .env.local.
import { describe, it, expect } from "vitest";
import { enrichSchema, buildPages } from "../ingest";
import { planQuery, synthesizeAnswer } from "../query";
import { guardReadOnlySql } from "../sql-guard";
import type { RawTable } from "../introspect";
import type { DigResult } from "../types";

const hasKey = Boolean(process.env.FIREWORKS_API_KEY);

const raw: RawTable[] = [
  {
    name: "users",
    columns: [
      { name: "id", type: "uuid", nullable: false, isPrimaryKey: true },
      { name: "email", type: "text", nullable: false, isPrimaryKey: false },
      { name: "created_at", type: "timestamptz", nullable: false, isPrimaryKey: false },
    ],
    foreignKeys: [],
    rowCount: 1284,
  },
  {
    name: "orders",
    columns: [
      { name: "id", type: "uuid", nullable: false, isPrimaryKey: true },
      { name: "user_id", type: "uuid", nullable: false, isPrimaryKey: false },
      { name: "status", type: "text", nullable: false, isPrimaryKey: false },
      { name: "amount", type: "numeric", nullable: false, isPrimaryKey: false },
      { name: "created_at", type: "timestamptz", nullable: false, isPrimaryKey: false },
    ],
    foreignKeys: [{ column: "user_id", refTable: "users", refColumn: "id" }],
    rowCount: 5039,
  },
];

describe.skipIf(!hasKey)("knowledge layer — live Fireworks e2e", () => {
  it("enriches the schema into valid JSON", { timeout: 60000 }, async () => {
    const e = await enrichSchema(raw);
    console.log("ENRICHMENT:", JSON.stringify(e, null, 2).slice(0, 1200));
    expect(Array.isArray(e.tables)).toBe(true);
    expect(Array.isArray(e.metrics)).toBe(true);
  });

  it("plans grounded SQL and synthesizes an answer", { timeout: 150000 }, async () => {
    // Use a fixed enrichment so this test makes only 2 live calls (plan + synth).
    const pages = buildPages("ws-live", "conn-live", raw, {
      tables: [
        { table: "users", description: "Registered users", grain: "one row per user" },
        { table: "orders", description: "Customer orders", grain: "one row per order", tenantColumn: "user_id" },
      ],
      metrics: [{ name: "orders_by_status", description: "orders grouped by status", sql: "SELECT status, COUNT(*) AS order_count FROM orders GROUP BY status" }],
    });
    const indexLines = pages.map((p) => `- ${p.path} — ${p.title}`).join("\n");
    const pageSpecs = JSON.stringify(
      pages.map((p) => ({ path: p.path, type: p.type, accessSpec: p.accessSpec })),
    );

    const plan = await planQuery("How many orders does each user status have?", indexLines, pageSpecs);
    console.log("PLANNED SQL:", plan.sql);
    expect(plan.sql.toLowerCase()).toMatch(/^\s*(select|with)\b/);
    // grounded: references a real table from the map
    expect(plan.sql.toLowerCase()).toMatch(/orders|users/);
    // and survives the read-only guard
    const guarded = guardReadOnlySql(plan.sql, { maxRows: 1000 });
    expect(guarded.toLowerCase()).toContain("select");

    // Mock the dig (no live external DB configured) and synthesize.
    const dig: DigResult = {
      tool: "sql",
      sql: guarded,
      columns: ["status", "n"],
      rows: [
        { status: "paid", n: 3200 },
        { status: "pending", n: 1100 },
        { status: "refunded", n: 739 },
      ],
      rowCount: 3,
    };
    const answer = await synthesizeAnswer("How many orders does each user status have?", plan, dig);
    console.log("ANSWER:", answer.answerMd);
    expect(answer.answerMd.length).toBeGreaterThan(0);
  });
});
