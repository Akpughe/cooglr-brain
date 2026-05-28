import type { QueryPlan } from "../types";
import type { DigTool } from "./types";
import { sqlDigTool } from "./sql-dig";

// v1 registers only the SQL dig tool. Later sub-projects push vector / keyword /
// API tools here; the planner and loop stay unchanged.
const TOOLS: DigTool[] = [sqlDigTool];

export function pickDigTool(plan: QueryPlan): DigTool {
  const tool = TOOLS.find((t) => t.canHandle(plan));
  if (!tool) throw new Error("No dig tool can handle this plan");
  return tool;
}
