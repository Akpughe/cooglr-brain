import type { QueryPlan, DigResult } from "../types";

// The dig context. `query` is injected by the route (wired to the live
// read-only adapter) so dig tools stay testable without a real database.
export interface DigContext {
  connectionId?: string;
  workspaceId?: string; // for the vector dig tool (Qdrant tenancy filter)
  maxRows: number;
  // SQL dig: injected read-only query runner. Optional — vector dig doesn't use it.
  query?: (sql: string) => Promise<{
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
  }>;
}

// A dig tool fetches actual data for a plan. v1 ships only the SQL tool; later
// sub-projects register vector / keyword / API tools behind this same contract.
export interface DigTool {
  name: string;
  canHandle(plan: QueryPlan): boolean;
  run(plan: QueryPlan, ctx: DigContext): Promise<DigResult>;
}
