"use client";

// Python/Plotly-style charts + clean downloadable data tables, shared by the
// inline assistant message and the document side panel. The actual plotly.js
// renderer is dynamically imported (ssr:false) so it stays client-only.

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Download, Table as TableIcon } from "lucide-react";

const PlotlyImpl = dynamic(() => import("./plotly-impl"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12.5 }}>
      Rendering chart…
    </div>
  ),
});

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

// Vibrant qualitative palette (plotly-express "Vivid"-flavored).
const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#dc2626", "#0891b2", "#db2777", "#65a30d"];

const FONT = { family: "Inter, system-ui, sans-serif", size: 12, color: "#3a3a3a" };

function buildTraces(chart: ChartSpec): unknown[] {
  const categories = chart.data.map((d) => d.name);

  if (chart.type === "pie") {
    return [
      {
        type: "pie",
        labels: categories,
        values: chart.data.map((d) => d.value),
        marker: { colors: categories.map((_, i) => PALETTE[i % PALETTE.length]) },
        textinfo: "label+percent",
        hole: 0.45,
        sort: false,
      },
    ];
  }

  const series = chart.series?.length
    ? chart.series
    : [{ name: chart.yTitle ?? "Value", values: chart.data.map((d) => d.value) }];

  return series.map((s, i) => {
    const color = PALETTE[i % PALETTE.length];
    if (chart.type === "line") {
      return {
        type: "scatter",
        mode: "lines+markers",
        name: s.name,
        x: categories,
        y: s.values,
        line: { color, width: 2.5, shape: "spline", smoothing: 0.6 },
        marker: { color, size: 6 },
      };
    }
    return {
      type: "bar",
      name: s.name,
      x: categories,
      y: s.values,
      marker: { color, line: { width: 0 } },
    };
  });
}

export function PlotlyChart({ chart, height = 280 }: { chart: ChartSpec; height?: number }) {
  const data = useMemo(() => buildTraces(chart), [chart]);
  const showLegend = chart.type === "pie" || (chart.series?.length ?? 0) > 1;

  const seriesNames = chart.series?.length ? chart.series.map((s) => s.name).join(", ") : "";
  const chartLabel = `${chart.title ?? "Chart"}: ${chart.type} chart${seriesNames ? ` with series ${seriesNames}` : ""}`;

  const layout = useMemo(
    () => ({
      autosize: true,
      height,
      margin: { l: 52, r: 16, t: chart.title ? 34 : 12, b: showLegend ? 58 : 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: FONT,
      title: chart.title ? { text: chart.title, font: { ...FONT, size: 14, color: "#1a1a1a" }, x: 0, xanchor: "left" } : undefined,
      barmode: chart.barmode ?? "group",
      bargap: 0.28,
      bargroupgap: 0.08,
      showlegend: showLegend,
      legend: {
        orientation: "h",
        yanchor: "top",
        y: -0.16,
        x: 0,
        font: { ...FONT, size: 11.5 },
      },
      xaxis: {
        automargin: true,
        tickfont: { ...FONT, size: 11 },
        showgrid: false,
        zeroline: false,
        linecolor: "#ececec",
      },
      yaxis: {
        title: chart.yTitle ? { text: chart.yTitle, font: { ...FONT, size: 11.5 } } : undefined,
        automargin: true,
        tickfont: { ...FONT, size: 11 },
        gridcolor: "#f0f0f0",
        zeroline: false,
      },
    }),
    [chart, height, showLegend]
  );

  return (
    <div role="img" aria-label={chartLabel} style={{ width: "100%", height }}>
      <PlotlyImpl data={data} layout={layout} />
    </div>
  );
}

function toCsv(spec: TableSpec): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [spec.columns, ...spec.rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCsv(spec: TableSpec) {
  const name = spec.filename ?? "data.csv";
  const blob = new Blob([toCsv(spec)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".csv") ? name : `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isNumericColumn(rows: (string | number)[][], col: number): boolean {
  return rows.every((r) => typeof r[col] === "number");
}

/** Identifier-like columns (years, ids, codes) should render without thousands separators. */
function isRawColumn(name: string): boolean {
  return /(^|[ _])(year|id|code|zip|postal|phone|sku|no|rank|qtr|quarter)([ _]|$)/i.test(name);
}

function formatCell(cell: string | number, raw: boolean): string {
  if (typeof cell !== "number") return cell;
  return raw ? String(cell) : cell.toLocaleString();
}

/** Clean data table with a filename + row-count header and a CSV download button. */
export function DataTable({ table }: { table: TableSpec }) {
  const name = table.filename ?? "data.csv";
  const n = table.rows.length;

  return (
    <div className="card" style={{ overflow: "hidden", margin: "14px 0 0", borderRadius: "var(--r-card)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <span className="fic fic-file" style={{ flexShrink: 0 }}>
          <TableIcon className="lucide" aria-hidden="true" style={{ width: 15, height: 15 }} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
          {name}
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>(all {n} {n === 1 ? "row" : "rows"})</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-outline"
          style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", fontSize: 12.5 }}
          onClick={() => downloadCsv(table)}
        >
          <Download aria-hidden="true" style={{ width: 14, height: 14 }} />
          Download
        </button>
      </div>
      <div className="answer-md" style={{ overflowX: "auto" }}>
        <table aria-label={name} style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <caption
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {name}
          </caption>
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "9px 14px",
                    color: "var(--ink-3)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--line-soft)",
                    background: "var(--hover-soft)",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => {
                  const numeric = isNumericColumn(table.rows, ci);
                  const raw = isRawColumn(table.columns[ci] ?? "");
                  return (
                    <td
                      key={ci}
                      style={{
                        padding: "9px 14px",
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        borderBottom: ri === n - 1 ? "none" : "1px solid var(--line-soft)",
                        fontVariantNumeric: numeric ? "tabular-nums" : undefined,
                        textAlign: numeric ? "right" : "left",
                        fontFamily: numeric ? "var(--font-mono)" : undefined,
                      }}
                    >
                      {formatCell(cell, raw)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
