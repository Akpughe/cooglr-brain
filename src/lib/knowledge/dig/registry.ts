import type { QueryPlan } from "../types";
import type { DigTool } from "./types";
import { sqlDigTool } from "./sql-dig";
import { vectorDigTool } from "./vector-dig";

// Registered dig tools. The planner picks per query: SQL for DB questions,
// vector for content questions. Keyword/API tools slot in here later.
const TOOLS: DigTool[] = [sqlDigTool, vectorDigTool];

export function pickDigTool(plan: QueryPlan): DigTool {
  const tool = TOOLS.find((t) => t.canHandle(plan));
  if (!tool) throw new Error("No dig tool can handle this plan");
  return tool;
}
