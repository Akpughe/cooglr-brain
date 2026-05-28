import { describe, it, expect, vi } from "vitest";
import { runQueryLoop, type LoopDeps } from "../query";
import type { QueryPlan, DigResult } from "../types";

const fakePlan: QueryPlan = {
  question: "how many users?",
  pagePaths: ["db/c1/tables/users"],
  tables: ["users"],
  sql: "SELECT count(*) n FROM users",
  wantsChart: false,
};
const fakeDig: DigResult = { tool: "sql", sql: fakePlan.sql, columns: ["n"], rows: [{ n: 3 }], rowCount: 1 };

describe("runQueryLoop", () => {
  it("calls plan -> dig -> synthesize in order, once, and returns the answer", async () => {
    const order: string[] = [];
    const deps: LoopDeps = {
      plan: vi.fn(async () => { order.push("plan"); return fakePlan; }),
      dig: vi.fn(async () => { order.push("dig"); return fakeDig; }),
      synthesize: vi.fn(async () => { order.push("synthesize"); return { answerMd: "3 users", chart: null }; }),
    };

    const out = await runQueryLoop("how many users?", deps);

    expect(order).toEqual(["plan", "dig", "synthesize"]);
    expect(deps.plan).toHaveBeenCalledOnce();
    expect(deps.dig).toHaveBeenCalledOnce();
    expect(out.answerMd).toBe("3 users");
    expect(out.dig.rows).toEqual([{ n: 3 }]);
  });

  it("retries up to maxIterations when a step throws, then surfaces the error", async () => {
    const plan = vi.fn(async () => fakePlan);
    const dig = vi.fn(async () => { throw new Error("dig failed"); });
    const synthesize = vi.fn();

    await expect(
      runQueryLoop("q", { plan, dig, synthesize: synthesize as unknown as LoopDeps["synthesize"], maxIterations: 2 }),
    ).rejects.toThrow("dig failed");
    expect(plan).toHaveBeenCalledTimes(2);
    expect(synthesize).not.toHaveBeenCalled();
  });
});
