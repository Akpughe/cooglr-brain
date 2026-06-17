"use client";

import { useState } from "react";
import { BarChart3, ChevronRight, Code2, FileText, Database } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { AgentArtifact } from "./types";

type KnownChart = { type: "bar" | "line" | "pie"; data: { name: string; value: number }[] };
const CHART_COLORS = ["#c2410c", "#16a34a", "#2563eb", "#d97706", "#7c3aed", "#0891b2"];

function isKnownChart(c: unknown): c is KnownChart {
  return Boolean(c && typeof c === "object" && "type" in (c as object) && Array.isArray((c as { data?: unknown }).data));
}

function ChartView({ chart }: { chart: KnownChart }) {
  return (
    <div className="h-[150px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {chart.type === "line" ? (
          <LineChart data={chart.data} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--agent-border)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--agent-text-muted)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--agent-text-muted)" }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
          </LineChart>
        ) : chart.type === "pie" ? (
          <PieChart>
            <Tooltip />
            <Pie data={chart.data} dataKey="value" nameKey="name" outerRadius={64} innerRadius={36}>
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
          </PieChart>
        ) : (
          <BarChart data={chart.data} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--agent-border)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--agent-text-muted)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--agent-text-muted)" }} />
            <Tooltip />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-medium" style={{ color: "var(--agent-text)" }}>
      {children}
    </div>
  );
}

function Faint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5 text-[13px]" style={{ color: "var(--agent-text-faint)" }}>{children}</div>;
}

export function AgentOutputsCard({ artifact }: { artifact: AgentArtifact | null }) {
  const [showSql, setShowSql] = useState(false);
  const chart = isKnownChart(artifact?.chart) ? (artifact!.chart as KnownChart) : null;
  const hasSources = (artifact?.citations?.length ?? 0) > 0 || (artifact?.origins?.length ?? 0) > 0;

  return (
    <div
      className="overflow-hidden rounded-[var(--agent-radius-card)] border agent-rise"
      style={{ borderColor: "var(--agent-border)", background: "var(--card)", boxShadow: "var(--agent-shadow-composer)" }}
    >
      {/* Outputs */}
      <div className="p-3.5">
        <Label>Outputs</Label>
        {!artifact ? (
          <Faint>No artifacts yet</Faint>
        ) : (
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--agent-text-muted)" }}>
              {artifact.source === "database" ? <Database className="size-3.5" /> : <FileText className="size-3.5" />}
              {artifact.source === "database" ? "Answered from live data" : "Answered from documents"}
            </div>
            {chart && (
              <div className="rounded-[10px] border p-2" style={{ borderColor: "var(--agent-border)", background: "var(--agent-rail)" }}>
                <div className="mb-1 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--agent-text-muted)" }}>
                  <BarChart3 className="size-3.5" /> Growth chart
                </div>
                <ChartView chart={chart} />
              </div>
            )}
            {artifact.sql && (
              <div>
                <button
                  onClick={() => setShowSql((v) => !v)}
                  className="flex items-center gap-1.5 text-[12.5px] transition-colors"
                  style={{ color: "var(--agent-text-muted)" }}
                >
                  <Code2 className="size-3.5" /> Query
                  <ChevronRight className={cn("size-3.5 transition-transform", showSql && "rotate-90")} />
                </button>
                {showSql && (
                  <pre
                    className="mt-1.5 overflow-x-auto rounded-[10px] border p-2.5 text-[11.5px] leading-relaxed"
                    style={{ borderColor: "var(--agent-border)", background: "var(--agent-rail)", color: "var(--agent-text)" }}
                  >
                    <code>{artifact.sql}</code>
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t" style={{ borderColor: "var(--agent-border)" }} />

      {/* Sources */}
      <div className="p-3.5">
        <Label>Sources</Label>
        {!hasSources ? (
          <Faint>No sources yet</Faint>
        ) : (
          <div className="mt-2.5 space-y-2.5">
            {artifact?.origins && artifact.origins.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {artifact.origins.map((o) => (
                  <span
                    key={o}
                    className="rounded-full border px-2 py-0.5 text-[11.5px] capitalize"
                    style={{ borderColor: "var(--agent-border)", color: "var(--agent-text-muted)" }}
                  >
                    {o}
                  </span>
                ))}
              </div>
            )}
            {artifact?.citations?.map((c, i) => (
              <div key={c.fileId} className="flex items-center gap-2 text-[12.5px]">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-[10.5px] font-semibold"
                  style={{ background: "var(--agent-rail-active)", color: "var(--agent-text-muted)" }}
                >
                  {i + 1}
                </span>
                <FileText className="size-3.5 shrink-0" style={{ color: "var(--agent-text-faint)" }} />
                <span className="flex-1 truncate" style={{ color: "var(--agent-text)" }}>{c.fileId}</span>
                <span className="shrink-0 tabular-nums text-[11px]" style={{ color: "var(--agent-text-faint)" }}>
                  {(c.score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
