import { describe, it, expect } from "vitest";
import { inferJoins, buildAccessSpecs, type RawTable } from "../introspect";

const tables: RawTable[] = [
  {
    name: "users",
    columns: [{ name: "id", type: "uuid", nullable: false, isPrimaryKey: true }],
    foreignKeys: [],
  },
  {
    name: "orders",
    columns: [
      { name: "id", type: "uuid", nullable: false, isPrimaryKey: true },
      { name: "user_id", type: "uuid", nullable: false, isPrimaryKey: false },
    ],
    foreignKeys: [],
  },
];

describe("inferJoins", () => {
  it("infers orders.user_id -> users.id by name heuristic", () => {
    const joins = inferJoins(tables);
    expect(joins).toContainEqual({
      fromTable: "orders",
      fromColumn: "user_id",
      toTable: "users",
      toColumn: "id",
      declared: false,
    });
  });

  it("prefers a declared FK over a heuristic", () => {
    const withFk: RawTable[] = [
      tables[0],
      {
        ...tables[1],
        foreignKeys: [{ column: "user_id", refTable: "users", refColumn: "id" }],
      },
    ];
    const joins = inferJoins(withFk);
    const matches = joins.filter(
      (j) => j.fromTable === "orders" && j.fromColumn === "user_id",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].declared).toBe(true);
  });
});

describe("buildAccessSpecs", () => {
  it("produces one spec per table with its columns and relevant joins", () => {
    const specs = buildAccessSpecs("conn-1", tables);
    expect(specs).toHaveLength(2);
    const orders = specs.find((s) => s.table === "orders")!;
    expect(orders.connectionId).toBe("conn-1");
    expect(orders.columns?.map((c) => c.name)).toEqual(["id", "user_id"]);
    expect(orders.joins?.some((j) => j.toTable === "users")).toBe(true);
  });
});
