// Deterministic table + chart builders for the agent's database-query path.
//
// These are PURE functions: given the real SQL result rows (and column names),
// they produce a downloadable table and a sensibly-typed chart WITHOUT asking an
// LLM to fabricate numbers. The shapes below are kept byte-compatible with the
// frontend renderer in `src/components/agent-shell/agent-plotly-chart.tsx` —
// they're re-declared here (not imported) so server code never pulls in a
// "use client" module.

export interface ChartSpec {
  type: "bar" | "line" | "pie";
  /** Single-series points (also supplies the category/x labels for multi-series). */
  data: { name: string; value: number }[];
  /** Optional multi-series — one colored trace per entry, x = data[].name. */
  series?: { name: string; values: number[] }[];
  barmode?: "group" | "stack";
  title?: string;
  yTitle?: string;
}

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
  filename?: string;
}

type Row = Record<string, unknown> | unknown[];

// --- helpers ---------------------------------------------------------------

/** Read cell `col` from a row that may be a plain object or a positional array. */
function readCell(row: Row, col: string, idx: number): unknown {
  if (Array.isArray(row)) return row[idx];
  return (row as Record<string, unknown>)[col];
}

/** Coerce any value to a table-safe string|number. null/undefined -> "". */
function coerceCell(v: unknown): string | number {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Parse a value to a finite number, accepting numeric strings. null otherwise. */
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    // Strip thousands separators / currency-ish prefixes for robustness.
    const cleaned = t.replace(/[$,\s]/g, "");
    if (!/^-?\d*\.?\d+(?:e-?\d+)?$/i.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function slugify(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "export";
}

const TEMPORAL_RE = /date|day|week|month|year|time|quarter/i;

// --- table -----------------------------------------------------------------

export function buildTable(
  columns: string[],
  rows: Row[],
  opts?: { filename?: string; maxRows?: number },
): TableSpec {
  const maxRows = opts?.maxRows ?? 500;
  const cols = columns.slice();
  const capped = rows.slice(0, Math.max(0, maxRows));
  const outRows: (string | number)[][] = capped.map((row) =>
    cols.map((c, i) => coerceCell(readCell(row, c, i))),
  );
  const base = opts?.filename ? slugify(opts.filename) : "export";
  return { columns: cols, rows: outRows, filename: `${base}.csv` };
}

// --- chart -----------------------------------------------------------------

/**
 * Build a chart deterministically from the real rows, or return null when the
 * data isn't sensibly chartable. Strategy: the first non-numeric column is the
 * CATEGORY (x); numeric columns are MEASURES.
 */
export function buildChart(columns: string[], rows: Row[]): ChartSpec | null {
  if (!columns.length || !rows.length) return null;

  // Classify each column as numeric (every non-empty cell parses to a number).
  const isNumericCol: boolean[] = columns.map((c, i) => {
    let seen = 0;
    for (const row of rows) {
      const v = readCell(row, c, i);
      if (v === null || v === undefined || v === "") continue;
      seen++;
      if (toNumber(v) === null) return false;
    }
    return seen > 0;
  });

  const categoryIdx = isNumericCol.findIndex((n) => !n);
  if (categoryIdx === -1) return null; // all-numeric: no category axis

  const measureIdxs = columns
    .map((_, i) => i)
    .filter((i) => i !== categoryIdx && isNumericCol[i]);
  if (measureIdxs.length === 0) return null; // need at least one measure

  const categoryCol = columns[categoryIdx];
  const categories = rows.map((row) => String(coerceCell(readCell(row, categoryCol, categoryIdx))));

  // Require a sensible number of DISTINCT categories, and not all identical.
  const distinct = new Set(categories);
  if (distinct.size < 1 || distinct.size > 50) return null;
  if (categories.length > 1 && distinct.size === 1) return null;

  const type: ChartSpec["type"] = TEMPORAL_RE.test(categoryCol) ? "line" : "bar";

  // Single measure -> simple data points.
  if (measureIdxs.length === 1) {
    const mi = measureIdxs[0];
    const measureCol = columns[mi];
    const data = rows.map((row) => ({
      name: String(coerceCell(readCell(row, categoryCol, categoryIdx))),
      value: toNumber(readCell(row, measureCol, mi)) ?? 0,
    }));
    if (new Set(data.map((d) => d.value)).size === 1) return null; // all-identical values
    return { type, data, yTitle: measureCol };
  }

  // Multiple measures -> grouped bar with one series per measure.
  const data = categories.map((name) => ({ name, value: 0 }));
  const series = measureIdxs.map((mi) => ({
    name: columns[mi],
    values: rows.map((row) => toNumber(readCell(row, columns[mi], mi)) ?? 0),
  }));
  const allVals = series.flatMap((s) => s.values);
  if (new Set(allVals).size === 1) return null; // all-identical values
  return { type: "bar", barmode: "group", data, series };
}
