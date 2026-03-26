"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

interface KeyMetric {
  label: string;
  value: string;
  change: string | null;
}

interface ChartConfig {
  type: "bar" | "line" | "pie";
  title: string;
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
}

interface ReportData {
  title: string;
  executiveSummary: string;
  keyMetrics: KeyMetric[];
  chart: ChartConfig;
  insights: string[];
  recommendations: string[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

const CHART_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4f46e5", "#c026d3", "#e11d48", "#f59e0b"];

export function FullReport({
  prompt,
  result,
  runId,
  cachedReport,
  onClose,
  onExport,
  onReportGenerated,
}: {
  prompt: string;
  result: QueryResult;
  runId: string;
  cachedReport?: ReportData | null;
  onClose: () => void;
  onExport: () => void;
  onReportGenerated?: (runId: string, report: ReportData) => void;
}) {
  const [report, setReport] = useState<ReportData | null>(cachedReport || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!report && !loading) {
      generate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to generate report");
      } else {
        const data = await res.json();
        setReport(data);
        // Cache the report
        if (onReportGenerated) onReportGenerated(runId, data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
    setLoading(false);
  }

  async function downloadPDF() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateReportPDF } = await import("@/lib/pdf");
      generateReportPDF(report, result, prompt);
    } catch (err) {
      alert("PDF generation failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setExporting(false);
  }

  if (loading) {
    return (
      <div className="space-y-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-block w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Generating executive report...</span>
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded animate-pulse w-2/3" />
          <div className="h-4 bg-muted rounded animate-pulse w-full" />
          <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="h-20 bg-muted rounded-lg animate-pulse" />
            <div className="h-20 bg-muted rounded-lg animate-pulse" />
            <div className="h-20 bg-muted rounded-lg animate-pulse" />
          </div>
          <div className="h-48 bg-muted rounded-lg animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={generate}>Retry</Button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{report.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Generated {new Date().toLocaleDateString()} · {result.rowCount} data points analyzed
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onExport}>Export to Sheets</Button>
          <Button size="sm" variant="outline" onClick={downloadPDF} disabled={exporting}>
            {exporting ? "Generating..." : "Download PDF"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="border-l-4 border-primary pl-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Executive Summary</p>
        <p className="text-sm leading-relaxed">{report.executiveSummary}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {report.keyMetrics.map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
              {metric.change && (
                <p className={`text-xs mt-1 font-medium ${metric.change.startsWith("+") ? "text-green-600" : metric.change.startsWith("-") ? "text-red-600" : "text-muted-foreground"}`}>
                  {metric.change}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      {report.chart && report.chart.data.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-4">{report.chart.title}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {report.chart.type === "bar" ? (
                  <BarChart data={report.chart.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey={report.chart.nameKey} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => typeof v === "number" ? v.toLocaleString() : v} />
                    <Tooltip formatter={(value) => typeof value === "number" ? value.toLocaleString() : String(value)} />
                    <Bar dataKey={report.chart.dataKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : report.chart.type === "line" ? (
                  <LineChart data={report.chart.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey={report.chart.nameKey} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => typeof v === "number" ? v.toLocaleString() : v} />
                    <Tooltip formatter={(value) => typeof value === "number" ? value.toLocaleString() : String(value)} />
                    <Line type="monotone" dataKey={report.chart.dataKey} stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={report.chart.data}
                      dataKey={report.chart.dataKey}
                      nameKey={report.chart.nameKey}
                      cx="50%" cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {report.chart.data.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => typeof value === "number" ? value.toLocaleString() : String(value)} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Key Insights</p>
        <div className="space-y-2">
          {report.insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-primary mt-0.5 text-sm">●</span>
              <p className="text-sm leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-muted/30 rounded-lg p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommendations</p>
        <div className="space-y-3">
          {report.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
