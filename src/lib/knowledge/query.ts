import type { QueryPlan, DigResult } from "./types";
import { complete, extractJson } from "./llm";
import { DEFAULT_AGENTS_MD } from "./agents-md";
import { buildTable, buildChart } from "./chart-builder";
import type { ChartSpec, TableSpec } from "./chart-builder";

export interface SynthesisResult {
  answerMd: string;
  chart?: { type: "bar" | "line" | "pie"; data: { name: string; value: number }[] } | null;
}

export interface QueryOutcome {
  plan: QueryPlan;
  dig: DigResult;
  answerMd: string;
  // Computed DETERMINISTICALLY from the real dig rows (preferred over the LLM's
  // fabricated chart). chart is null when the data isn't sensibly chartable.
  chart: ChartSpec | null;
  table?: TableSpec;
}

// Injected dependencies — keeps the loop testable without LLM/DB.
export interface LoopDeps {
  plan: (question: string) => Promise<QueryPlan>;
  dig: (plan: QueryPlan) => Promise<DigResult>;
  synthesize: (question: string, plan: QueryPlan, dig: DigResult) => Promise<SynthesisResult>;
  maxIterations?: number;
}

// The agentic-ready loop: Plan -> Dig -> Synthesize. v1 resolves in one pass; the
// iteration cap is the seam where multi-hop retrieval (re-plan on weak dig) lands.
export async function runQueryLoop(question: string, deps: LoopDeps): Promise<QueryOutcome> {
  const maxIterations = deps.maxIterations ?? 1;
  let lastErr: unknown;
  for (let i = 0; i < maxIterations; i++) {
    try {
      const plan = await deps.plan(question);
      const dig = await deps.dig(plan);
      const synth = await deps.synthesize(question, plan, dig);
      // Build the REAL table + chart deterministically from the actual rows.
      // These replace the LLM-fabricated chart and add the (previously missing)
      // downloadable table whenever the dig produced rows.
      const table =
        dig.rows.length > 0
          ? buildTable(dig.columns, dig.rows, { filename: plan.tables[0] ?? "export" })
          : undefined;
      const computedChart = dig.rows.length > 0 ? buildChart(dig.columns, dig.rows) : null;
      return {
        plan,
        dig,
        answerMd: synth.answerMd,
        // Prefer the deterministic chart; fall back to nothing (never the LLM's).
        chart: computedChart,
        table,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("Query loop produced no result");
}

// --- LLM glue (needs an AI key) ---

// Plan: read the index + relevant pages, produce grounded SQL.
export async function planQuery(
  question: string,
  indexLines: string,
  pageSpecs: string,
): Promise<QueryPlan> {
  const user = `Question: ${question}\n\nIndex:\n${indexLines}\n\nRelevant page access specs (JSON):\n${pageSpecs}\n\nReturn JSON: {"pagePaths":[],"tables":[],"sql":"<single read-only SELECT>","wantsChart":bool,"chartHint":"bar|line|pie"}\n\nSQL rules:\n- Use ONLY real table/column names from the access specs.\n- Identifiers are CASE-SENSITIVE: wrap every table and column name in double quotes EXACTLY as written in the specs, e.g. SELECT count(*) FROM "Activity". Never lowercase or unquote a mixed-case name.`;
  const text = await complete(DEFAULT_AGENTS_MD, user);
  const parsed = extractJson<Partial<QueryPlan>>(text);
  return {
    question,
    pagePaths: parsed.pagePaths ?? [],
    tables: parsed.tables ?? [],
    sql: parsed.sql ?? "",
    wantsChart: parsed.wantsChart ?? false,
    chartHint: parsed.chartHint,
  };
}

// Synthesize: compose an answer from the actual rows.
export async function synthesizeAnswer(
  question: string,
  plan: QueryPlan,
  dig: DigResult,
): Promise<SynthesisResult> {
  const sample = dig.rows.slice(0, 30);
  const user = `Question: ${question}\n\nSQL run:\n${dig.sql}\n\nRows (${dig.rowCount}, sample):\n${JSON.stringify(sample)}\n\nReturn JSON: {"answerMd":"<concise answer citing the numbers>","chart":${plan.wantsChart ? '{"type":"bar|line|pie","data":[{"name","value"}]}' : "null"}}`;
  const text = await complete(DEFAULT_AGENTS_MD, user);
  try {
    const parsed = extractJson<SynthesisResult>(text);
    return { answerMd: parsed.answerMd ?? "", chart: parsed.chart ?? null };
  } catch {
    return { answerMd: text, chart: null };
  }
}
