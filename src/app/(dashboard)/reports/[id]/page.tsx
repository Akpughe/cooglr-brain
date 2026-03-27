"use client";

import { useEffect, useState, useRef, use } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FullReport } from "@/components/reports/full-report";

interface DbConnection { id: string; name: string; db_type: string }
interface QueryResult { columns: string[]; rows: Record<string, unknown>[]; rowCount: number }
interface ReportRun {
  id: string; prompt: string; generated_sql: string | null;
  result_columns: string[]; result_row_count: number; error: string | null;
  created_at: string; result?: QueryResult | null; loading?: boolean;
  thinkingStep?: string; summaryParts?: { text: string; bold?: boolean }[];
  expanded?: boolean; showFullReport?: boolean; cachedReport?: Record<string, unknown> | null;
}

export default function ReportSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  const [runs, setRuns] = useState<ReportRun[]>(() => {
    if (initialQuery) {
      return [{ id: `init-${Date.now()}`, prompt: initialQuery, generated_sql: null, result_columns: [], result_row_count: 0, error: null, created_at: new Date().toISOString(), loading: true, thinkingStep: "Understanding your question..." }];
    }
    return [];
  });
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialExecuted = useRef(false);

  useEffect(() => {
    fetch("/api/db/connections").then((r) => r.json()).then((all: DbConnection[]) => setConnections(all.filter((c: DbConnection & { is_active?: boolean }) => (c as { is_active?: boolean }).is_active !== false)));
    if (!initialQuery) {
      fetch(`/api/reports/runs?sessionId=${sessionId}`).then((r) => r.json()).then((data: ReportRun[]) => {
        setRuns(data.map((r) => ({ ...r, cachedReport: (r as unknown as Record<string, unknown>).generated_report as Record<string, unknown> | null || null })));
      });
    }
  }, [sessionId, initialQuery]);

  useEffect(() => {
    if (initialQuery && !initialExecuted.current && connections.length > 0 && runs.length > 0 && runs[0]?.loading) {
      initialExecuted.current = true;
      executeQuery(initialQuery, runs[0].id);
    }
  }, [connections]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [runs]);

  async function runQuery(text: string) {
    if (!text.trim() || connections.length === 0) return;
    setLoading(true); setPrompt("");
    const runId = `run-${Date.now()}`;
    setRuns((prev) => [...prev, { id: runId, prompt: text, generated_sql: null, result_columns: [], result_row_count: 0, error: null, created_at: new Date().toISOString(), loading: true, thinkingStep: "Understanding your question..." }]);
    await executeQuery(text, runId);
    setLoading(false);
    textareaRef.current?.focus();
  }

  async function executeQuery(text: string, runId: string) {
    try {
      updateRun(runId, { thinkingStep: "Analyzing your data and planning the query..." });
      const previousRuns = runs.filter((r) => r.id !== runId && !r.loading && r.generated_sql).map((r) => ({ prompt: r.prompt, sql: r.generated_sql, rowCount: r.result_row_count }));
      const genRes = await fetch("/api/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text, connectionId: connections[0].id, conversationHistory: previousRuns }) });
      if (!genRes.ok) { const err = await genRes.json(); updateRun(runId, { error: err.error, loading: false, thinkingStep: undefined }); saveRun(text, null, [], 0, err.error); setLoading(false); return; }
      const { sql } = await genRes.json();
      updateRun(runId, { generated_sql: sql, thinkingStep: "Running query..." });
      const queryRes = await fetch("/api/db/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: connections[0].id, query: sql }) });
      const data = await queryRes.json();
      if (!queryRes.ok) { updateRun(runId, { error: data.error, loading: false, thinkingStep: undefined }); saveRun(text, sql, [], 0, data.error); }
      else { const result: QueryResult = data; updateRun(runId, { generated_sql: sql, result_columns: result.columns, result_row_count: result.rowCount || 0, result, loading: false, thinkingStep: undefined, summaryParts: buildSummary(text, result), expanded: true }); saveRun(text, sql, result.columns, result.rowCount || 0, null); }
    } catch (err) { const msg = err instanceof Error ? err.message : "Something went wrong"; updateRun(runId, { error: msg, loading: false, thinkingStep: undefined }); saveRun(text, null, [], 0, msg); }
    setLoading(false);
  }

  function buildSummary(userPrompt: string, result: QueryResult): { text: string; bold?: boolean }[] {
    const parts: { text: string; bold?: boolean }[] = [{ text: "Found " }, { text: `${result.rowCount || 0} results`, bold: true }, { text: ` for "${userPrompt}". ` }];
    for (const col of result.columns) {
      const vals = result.rows.map((r) => r[col]).filter((v) => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && v !== ""));
      if (vals.length === result.rows.length && vals.length > 0) {
        const lc = col.toLowerCase();
        if (lc.includes("revenue") || lc.includes("amount") || lc.includes("total") || lc.includes("price") || lc.includes("count") || lc.includes("quantity")) {
          const total = vals.map(Number).reduce((a, b) => a + b, 0);
          parts.push({ text: `Total ${col.replace(/_/g, " ")}: ` }, { text: formatNumber(total), bold: true }, { text: ". " });
        }
      }
    }
    return parts;
  }

  function updateRun(id: string, updates: Partial<ReportRun>) { setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r))); }
  function toggleExpand(id: string) { setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r))); }

  async function saveRun(p: string, sql: string | null, cols: string[], rowCount: number, error: string | null) {
    await fetch("/api/reports/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, prompt: p, generatedSql: sql, resultColumns: cols, resultRowCount: rowCount, error }) });
  }

  async function rerunQuery(run: ReportRun) {
    if (!run.generated_sql || connections.length === 0) return;
    updateRun(run.id, { loading: true, thinkingStep: "Re-running query..." });
    const queryRes = await fetch("/api/db/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: connections[0].id, query: run.generated_sql }) });
    if (queryRes.ok) { const result = await queryRes.json(); updateRun(run.id, { result, expanded: true, loading: false, thinkingStep: undefined, summaryParts: buildSummary(run.prompt, result) }); }
    else { updateRun(run.id, { loading: false, thinkingStep: undefined }); }
  }

  async function exportToSheets(run: ReportRun) {
    if (!run.result) return;
    const res = await fetch("/api/reports/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: run.prompt, columns: run.result.columns, rows: run.result.rows }) });
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, "_blank");
    else alert(data.error || "Export failed. Connect Google in Settings.");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runQuery(prompt); }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {runs.map((run) => (
            <div key={run.id} className="space-y-4">
              {/* User prompt */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-5 py-3 text-sm max-w-lg shadow-warm">
                  {run.prompt}
                </div>
              </div>

              {/* Loading */}
              {run.loading && (
                <div className="flex items-start gap-3 max-w-2xl">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  </div>
                  <div className="flex-1 space-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span className="text-sm text-muted-foreground">{run.thinkingStep}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded-full animate-pulse w-[80%]" />
                      <div className="h-3 bg-muted rounded-full animate-pulse w-[60%]" />
                      <div className="h-3 bg-muted rounded-full animate-pulse w-[70%]" />
                      <div className="h-10 bg-muted rounded-xl animate-pulse w-full mt-2" />
                      <div className="h-10 bg-muted rounded-xl animate-pulse w-full" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {run.error && !run.loading && (
                <div className="flex items-start gap-3 max-w-2xl">
                  <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </div>
                  <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/15 text-sm text-destructive flex-1">{run.error}</div>
                </div>
              )}

              {/* Results */}
              {!run.loading && !run.error && run.result && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Summary */}
                    {run.summaryParts && (
                      <p className="text-sm leading-relaxed">
                        {run.summaryParts.map((part, i) => part.bold ? <strong key={i} className="text-primary">{part.text}</strong> : <span key={i}>{part.text}</span>)}
                      </p>
                    )}

                    {/* Data card */}
                    <div className="rounded-xl border border-border overflow-hidden shadow-warm bg-card">
                      {/* Card header */}
                      <div className="px-4 py-2.5 bg-muted/30 flex items-center justify-between border-b border-border">
                        <button onClick={() => toggleExpand(run.id)} className="flex items-center gap-2 hover:text-primary transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${run.expanded ? "rotate-90" : ""}`}><polyline points="9 18 15 12 9 6"/></svg>
                          <span className="text-sm font-medium">{formatNumber(run.result_row_count)} rows</span>
                          <span className="text-xs text-muted-foreground">· {run.result_columns.length} columns</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" className="h-7 text-[11px] rounded-lg px-3" onClick={() => updateRun(run.id, { showFullReport: !run.showFullReport })}>
                            {run.showFullReport ? "Hide Report" : run.cachedReport ? "View Report" : "Full Report"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg px-3 border-border" onClick={() => exportToSheets(run)}>
                            Sheets
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] rounded-lg px-2 text-muted-foreground" onClick={() => { if (run.generated_sql) navigator.clipboard.writeText(run.generated_sql); }}>
                            SQL
                          </Button>
                        </div>
                      </div>

                      {/* Table */}
                      {run.expanded && (
                        <div className="overflow-auto max-h-[50vh]">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/20 border-b border-border">
                                <TableHead className="text-[10px] text-muted-foreground w-10 sticky top-0 bg-muted/20 z-10">#</TableHead>
                                {run.result.columns.map((col) => (
                                  <TableHead key={col} className="text-[11px] font-semibold whitespace-nowrap px-3 sticky top-0 bg-muted/20 z-10">{col.replace(/_/g, " ")}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {run.result.rows.map((row, i) => (
                                <TableRow key={i} className="hover:bg-muted/20 border-b border-border/50 last:border-0">
                                  <TableCell className="text-[10px] text-muted-foreground w-10">{i + 1}</TableCell>
                                  {run.result!.columns.map((col) => (
                                    <TableCell key={col} className="text-[13px] whitespace-nowrap px-3">{formatCell(row[col])}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Full report */}
                    {run.showFullReport && run.result && (
                      <FullReport prompt={run.prompt} result={run.result} runId={run.id} cachedReport={run.cachedReport as never} onClose={() => updateRun(run.id, { showFullReport: false })} onExport={() => exportToSheets(run)}
                        onReportGenerated={(id, report) => { updateRun(id, { cachedReport: report as unknown as Record<string, unknown> }); fetch("/api/reports/runs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: id, generatedReport: report }) }).catch(() => {}); }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Past runs without data */}
              {!run.loading && !run.error && !run.result && run.result_row_count > 0 && (
                <div className="flex items-start gap-3 max-w-2xl">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-muted-foreground"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  </div>
                  <button onClick={() => rerunQuery(run)} className="flex-1 text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex items-center justify-between shadow-warm">
                    <div>
                      <span className="text-sm font-medium">{formatNumber(run.result_row_count)} rows</span>
                      <span className="text-muted-foreground text-sm ml-2">{run.result_columns.slice(0, 3).map((c) => c.replace(/_/g, " ")).join(", ")}{run.result_columns.length > 3 && ` +${run.result_columns.length - 3}`}</span>
                    </div>
                    <span className="text-xs text-primary font-medium">Load →</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Floating input bar */}
      <div className="shrink-0 p-4 pb-5">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card border border-border rounded-2xl shadow-warm-md p-2 flex items-end gap-2">
            {/* Data source badge */}
            {connections.length > 0 && (
              <Badge variant="secondary" className="shrink-0 mb-1 ml-1 text-[10px] font-normal gap-1 rounded-lg h-6">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {connections[0]?.name}
              </Badge>
            )}
            <Textarea
              ref={textareaRef}
              placeholder="Ask a follow-up question about your data..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              className="flex-1 border-0 shadow-none focus-visible:ring-0 resize-none min-h-[36px] max-h-[120px] text-sm bg-transparent placeholder:text-muted-foreground/60"
            />
            <Button
              onClick={() => runQuery(prompt)}
              disabled={loading || !prompt.trim()}
              size="sm"
              className="rounded-xl h-8 px-4 shrink-0 mb-0.5"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
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
