import { describe, it, expect, vi } from "vitest";
import { sqlDigTool } from "../dig/sql-dig";
import { pickDigTool } from "../dig/registry";
import { GuardError } from "../sql-guard";
import type { QueryPlan } from "../types";
import type { DigContext } from "../dig/types";

function plan(sql: string): QueryPlan {
  return { question: "q", pagePaths: [], tables: [], sql, wantsChart: false };
}

function ctx(query: DigContext["query"]): DigContext {
  return { connectionId: "c1", maxRows: 1000, query };
}

describe("sqlDigTool", () => {
  it("guards then runs the query, returning rows", async () => {
    const query = vi.fn(async (_sql: string) => ({
      columns: ["n"],
      rows: [{ n: 7 }],
      rowCount: 1,
    }));
    const res = await sqlDigTool.run(plan("SELECT count(*) n FROM users"), ctx(query));
    expect(query).toHaveBeenCalledOnce();
    // The guard wrapped/limited the SQL before it reached the query fn.
    expect(query.mock.calls[0][0].toLowerCase()).toContain("limit 1000");
    expect(res.tool).toBe("sql");
    expect(res.rows).toEqual([{ n: 7 }]);
  });

  it("rejects a write SQL via the guard before touching the db", async () => {
    const query = vi.fn();
    await expect(
      sqlDigTool.run(plan("DELETE FROM users"), ctx(query as unknown as DigContext["query"])),
    ).rejects.toThrow(GuardError);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("pickDigTool", () => {
  it("returns the sql tool for a plan with SQL", () => {
    expect(pickDigTool(plan("SELECT 1")).name).toBe("sql");
  });
  it("throws when no tool can handle the plan", () => {
    expect(() => pickDigTool(plan(""))).toThrow();
  });
});
