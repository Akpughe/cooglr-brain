"use client";

import { useEffect, useState, useRef, use } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface DbConnection {
  id: string;
  name: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

interface ReportRun {
  id: string;
  prompt: string;
  generated_sql: string | null;
  result_columns: string[];
  result_row_count: number;
  error: string | null;
  created_at: string;
  result?: QueryResult | null;
  loading?: boolean;
  thinkingStep?: string;
  summaryParts?: { text: string; bold?: boolean }[];
  expanded?: boolean;
}

export default function ReportSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  // Initialize with the query bubble showing immediately if we have one
  const [runs, setRuns] = useState<ReportRun[]>(() => {
    if (initialQuery) {
      return [{
        id: `init-${Date.now()}`, prompt: initialQuery, generated_sql: null,
        result_columns: [], result_row_count: 0, error: null,
        created_at: new Date().toISOString(), loading: true,
        thinkingStep: "Understanding your question...",
      }];
    }
    return [];
  });
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialExecuted = useRef(false);

  useEffect(() => {
    fetch("/api/db/connections").then((r) => r.json()).then(setConnections);

    // If no initial query, load history
    if (!initialQuery) {
      fetch(`/api/reports/runs?sessionId=${sessionId}`).then((r) => r.json()).then(setRuns);
    }
  }, [sessionId, initialQuery]);

  // Execute the initial query once connections load (only once)
  useEffect(() => {
    if (initialQuery && !initialExecuted.current && connections.length > 0 && runs.length > 0 && runs[0]?.loading) {
      initialExecuted.current = true;
      executeQuery(initialQuery, runs[0].id);
    }
  }, [connections]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runs]);

  async function runQuery(text: string) {
    if (!text.trim() || connections.length === 0) return;
    setLoading(true);
    setPrompt("");
    const runId = `run-${Date.now()}`;
    setRuns((prev) => [...prev, {
      id: runId, prompt: text, generated_sql: null,
      result_columns: [], result_row_count: 0, error: null,
      created_at: new Date().toISOString(), loading: true,
      thinkingStep: "Understanding your question...",
    }]);
    await executeQuery(text, runId);
    setLoading(false);
  }

  async function executeQuery(text: string, runId: string) {
    try {
      updateRun(runId, { thinkingStep: "Analyzing your data and planning the query..." });

      const genRes = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, connectionId: connections[0].id }),
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        updateRun(runId, { error: err.error, loading: false, thinkingStep: undefined });
        saveRun(text, null, [], 0, err.error);
        setLoading(false);
        return;
      }

      const { sql } = await genRes.json();
      updateRun(runId, { generated_sql: sql, thinkingStep: "Running query against database..." });

      const queryRes = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connections[0].id, query: sql }),
      });

      const data = await queryRes.json();

      if (!queryRes.ok) {
        updateRun(runId, { error: data.error, loading: false, thinkingStep: undefined });
        saveRun(text, sql, [], 0, data.error);
      } else {
        const result: QueryResult = data;
        updateRun(runId, {
          generated_sql: sql,
          result_columns: result.columns,
          result_row_count: result.rowCount || 0,
          result, loading: false, thinkingStep: undefined,
          summaryParts: buildSummary(text, result),
          expanded: true,
        });
        saveRun(text, sql, result.columns, result.rowCount || 0, null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      updateRun(runId, { error: msg, loading: false, thinkingStep: undefined });
      saveRun(text, null, [], 0, msg);
    }
    setLoading(false);
  }

  function buildSummary(prompt: string, result: QueryResult): { text: string; bold?: boolean }[] {
    const parts: { text: string; bold?: boolean }[] = [];
    const count = result.rowCount || 0;
    parts.push({ text: `Found ` });
    parts.push({ text: `${count} results`, bold: true });
    parts.push({ text: ` for "${prompt}". ` });

    // Add numeric highlights
    for (const col of result.columns) {
      const values = result.rows.map((r) => r[col]).filter((v) => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && v !== ""));
      if (values.length === result.rows.length && values.length > 0) {
        const lc = col.toLowerCase();
        if (lc.includes("revenue") || lc.includes("amount") || lc.includes("total") || lc.includes("price") || lc.includes("count") || lc.includes("quantity")) {
          const total = values.map(Number).reduce((a, b) => a + b, 0);
          parts.push({ text: `Total ${col.replace(/_/g, " ")}: ` });
          parts.push({ text: formatNumber(total), bold: true });
          parts.push({ text: ". " });
        }
      }
    }
    return parts;
  }

  function updateRun(id: string, updates: Partial<ReportRun>) {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function toggleExpand(id: string) {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)));
  }

  async function saveRun(prompt: string, sql: string | null, columns: string[], rowCount: number, error: string | null) {
    await fetch("/api/reports/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, prompt, generatedSql: sql, resultColumns: columns, resultRowCount: rowCount, error }),
    });
  }

  async function rerunQuery(run: ReportRun) {
    if (!run.generated_sql || connections.length === 0) return;
    updateRun(run.id, { loading: true, thinkingStep: "Re-running query..." });
    const queryRes = await fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: connections[0].id, query: run.generated_sql }),
    });
    if (queryRes.ok) {
      const result = await queryRes.json();
      updateRun(run.id, {
        result, expanded: true, loading: false, thinkingStep: undefined,
        summaryParts: buildSummary(run.prompt, result),
      });
    } else {
      updateRun(run.id, { loading: false, thinkingStep: undefined });
    }
  }

  async function exportToSheets(run: ReportRun) {
    if (!run.result) return;
    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: run.prompt, columns: run.result.columns, rows: run.result.rows }),
    });
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, "_blank");
    else alert(data.error || "Export failed. Make sure Google is connected in Settings.");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runQuery(prompt); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {runs.map((run) => (
            <div key={run.id} className="space-y-3">
              {/* User prompt */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 text-sm max-w-lg">
                  {run.prompt}
                </div>
              </div>

              {/* Loading */}
              {run.loading && (
                <div className="space-y-3 max-w-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-sm text-muted-foreground">{run.thinkingStep}</span>
                  </div>
                  <div className="space-y-2 ml-6">
                    <div className="h-3 bg-muted rounded-full animate-pulse w-4/5" />
                    <div className="h-3 bg-muted rounded-full animate-pulse w-3/5" />
                    <div className="h-3 bg-muted rounded-full animate-pulse w-2/3" />
                    <div className="h-8 bg-muted rounded animate-pulse w-full mt-3" />
                    <div className="h-8 bg-muted rounded animate-pulse w-full" />
                    <div className="h-8 bg-muted rounded animate-pulse w-full" />
                  </div>
                </div>
              )}

              {/* Error */}
              {run.error && !run.loading && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive max-w-xl">
                  {run.error}
                </div>
              )}

              {/* Results */}
              {!run.loading && !run.error && run.result && (
                <div className="space-y-3">
                  {/* Summary preamble */}
                  {run.summaryParts && (
                    <p className="text-sm leading-relaxed">
                      {run.summaryParts.map((part, i) => (
                        part.bold
                          ? <strong key={i}>{part.text}</strong>
                          : <span key={i}>{part.text}</span>
                      ))}
                    </p>
                  )}

                  {/* Accordion */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpand(run.id)}
                      className="w-full text-left px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{run.expanded ? "▼" : "▶"}</span>
                        <span className="text-sm font-medium">{formatNumber(run.result_row_count)} rows · {run.result_columns.length} columns</span>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportToSheets(run)}>
                          Export to Sheets
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                          if (run.generated_sql) navigator.clipboard.writeText(run.generated_sql);
                        }}>
                          Copy SQL
                        </Button>
                      </div>
                    </button>

                    {run.expanded && (
                      <div className="overflow-auto max-h-[55vh] border-t">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs text-muted-foreground w-12 sticky top-0 bg-muted/30">#</TableHead>
                              {run.result.columns.map((col) => (
                                <TableHead key={col} className="text-xs font-semibold whitespace-nowrap px-4 sticky top-0 bg-muted/30">
                                  {col.replace(/_/g, " ")}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {run.result.rows.map((row, i) => (
                              <TableRow key={i} className="hover:bg-muted/20">
                                <TableCell className="text-xs text-muted-foreground w-12">{i + 1}</TableCell>
                                {run.result!.columns.map((col) => (
                                  <TableCell key={col} className="text-sm whitespace-nowrap px-4">
                                    {formatCell(row[col])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Past runs without loaded result data — clickable to re-run */}
              {!run.loading && !run.error && !run.result && run.result_row_count > 0 && (
                <button
                  onClick={() => rerunQuery(run)}
                  className="w-full text-left p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors max-w-xl flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm font-medium">{formatNumber(run.result_row_count)} rows</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {run.result_columns.slice(0, 4).map((c) => c.replace(/_/g, " ")).join(", ")}
                      {run.result_columns.length > 4 && ` +${run.result_columns.length - 4} more`}
                    </span>
                  </div>
                  <span className="text-xs text-primary">Load results →</span>
                </button>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          {connections.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-muted border shrink-0 self-center">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {connections[0]?.name}
            </span>
          )}
          <Input
            placeholder="Ask a follow-up question about your data..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={() => runQuery(prompt)} disabled={loading || !prompt.trim()}>
            {loading ? "Running..." : "Run"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return new Date(str).toLocaleString();
  if (/^\d+(\.\d+)?$/.test(str) && str.length > 3) return formatNumber(Number(str));
  return str;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
