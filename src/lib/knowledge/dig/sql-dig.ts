import type { QueryPlan, DigResult } from "../types";
import type { DigTool, DigContext } from "./types";
import { guardReadOnlySql } from "../sql-guard";

// The SQL dig tool: guard the plan's SQL (read-only, single statement, capped),
// then run it through the injected read-only query function.
export const sqlDigTool: DigTool = {
  name: "sql",

  canHandle(plan: QueryPlan): boolean {
    return typeof plan.sql === "string" && plan.sql.trim().length > 0;
  },

  async run(plan: QueryPlan, ctx: DigContext): Promise<DigResult> {
    const guarded = guardReadOnlySql(plan.sql, { maxRows: ctx.maxRows });
    const res = await ctx.query(guarded);
    return {
      tool: "sql",
      sql: guarded,
      columns: res.columns,
      rows: res.rows,
      rowCount: res.rowCount,
    };
  },
};
