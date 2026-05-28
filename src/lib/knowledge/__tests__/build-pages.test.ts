import { describe, it, expect } from "vitest";
import { buildPages, type Enrichment } from "../ingest";
import type { RawTable } from "../introspect";

const raw: RawTable[] = [
  {
    name: "users",
    columns: [{ name: "id", type: "uuid", nullable: false, isPrimaryKey: true }],
    foreignKeys: [],
    rowCount: 10,
  },
  {
    name: "orders",
    columns: [
      { name: "id", type: "uuid", nullable: false, isPrimaryKey: true },
      { name: "user_id", type: "uuid", nullable: false, isPrimaryKey: false },
    ],
    foreignKeys: [],
    rowCount: 50,
  },
];

const enrichment: Enrichment = {
  tables: [{ table: "users", description: "People", grain: "one row per user", tenantColumn: "id" }],
  metrics: [{ name: "Signups", description: "count of users", sql: "SELECT count(*) FROM users" }],
};

describe("buildPages", () => {
  const pages = buildPages("ws-1", "conn-1", raw, enrichment);

  it("creates one database overview page", () => {
    expect(pages.filter((p) => p.type === "database")).toHaveLength(1);
  });

  it("creates one table page per table with its columns in access_spec", () => {
    const tablePages = pages.filter((p) => p.type === "table");
    expect(tablePages).toHaveLength(2);
    const orders = tablePages.find((p) => p.path.endsWith("/tables/orders"))!;
    expect(orders.accessSpec.columns?.map((c) => c.name)).toEqual(["id", "user_id"]);
  });

  it("merges enrichment grain/tenantColumn into the table access_spec", () => {
    const users = pages.find((p) => p.path.endsWith("/tables/users"))!;
    expect(users.accessSpec.grain).toBe("one row per user");
    expect(users.accessSpec.tenantColumn).toBe("id");
  });

  it("creates a relationship page for the inferred orders->users join", () => {
    const rels = pages.filter((p) => p.type === "relationship");
    expect(rels.some((p) => p.title.includes("orders.user_id"))).toBe(true);
    // inferred join is medium confidence
    expect(rels.find((p) => p.title.includes("orders.user_id"))!.confidence).toBe("medium");
  });

  it("creates a metric page carrying the vetted SQL in access_spec", () => {
    const metric = pages.find((p) => p.type === "metric")!;
    expect(metric.accessSpec.metricSql).toBe("SELECT count(*) FROM users");
  });

  it("scopes every page to the workspace and connection", () => {
    expect(pages.every((p) => p.workspaceId === "ws-1" && p.connectionId === "conn-1")).toBe(true);
  });
});
