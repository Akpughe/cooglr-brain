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
  // Client-side only
  result?: QueryResult | null;
  loading?: boolean;
}

export default function ReportSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<{ run: ReportRun; result: QueryResult } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialRan = useRef(false);

  useEffect(() => {
    fetch("/api/db/connections").then((r) => r.json()).then(setConnections);
    fetch(`/api/reports/runs?sessionId=${sessionId}`).then((r) => r.json()).then(setRuns);
  }, [sessionId]);

  // Run initial query from URL param
  useEffect(() => {
    if (initialQuery && !initialRan.current && connections.length > 0) {
      initialRan.current = true;
      runQuery(initialQuery);
    }
  }, [initialQuery, connections]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runs]);

  async function runQuery(text: string) {
    if (!text.trim() || connections.length === 0) return;
    setLoading(true);
    setPrompt("");

    const runPlaceholder: ReportRun = {
      id: `temp-${Date.now()}`,
      prompt: text,
      generated_sql: null,
      result_columns: [],
      result_row_count: 0,
      error: null,
      created_at: new Date().toISOString(),
      loading: true,
    };
    setRuns((prev) => [...prev, runPlaceholder]);

    try {
      // Generate SQL
      const genRes = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, connectionId: connections[0].id }),
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        updateRun(runPlaceholder.id, { error: err.error, loading: false });
        saveRun(text, null, [], 0, err.error);
        setLoading(false);
        return;
      }

      const { sql } = await genRes.json();

      // Execute query
      const queryRes = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connections[0].id, query: sql }),
      });

      const data = await queryRes.json();

      if (!queryRes.ok) {
        updateRun(runPlaceholder.id, { generated_sql: sql, error: data.error, loading: false });
        saveRun(text, sql, [], 0, data.error);
      } else {
        const result: QueryResult = data;
        updateRun(runPlaceholder.id, {
          generated_sql: sql,
          result_columns: result.columns,
          result_row_count: result.rowCount || 0,
          result,
          loading: false,
        });
        setActiveResult({ run: { ...runPlaceholder, generated_sql: sql, result_columns: result.columns, result_row_count: result.rowCount || 0 }, result });
        saveRun(text, sql, result.columns, result.rowCount || 0, null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      updateRun(runPlaceholder.id, { error: msg, loading: false });
      saveRun(text, null, [], 0, msg);
    }
    setLoading(false);
  }

  function updateRun(id: string, updates: Partial<ReportRun>) {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  async function saveRun(prompt: string, sql: string | null, columns: string[], rowCount: number, error: string | null) {
    await fetch("/api/reports/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        prompt,
        generatedSql: sql,
        resultColumns: columns,
        resultRowCount: rowCount,
        error,
      }),
    });
  }

  async function rerunQuery(run: ReportRun) {
    if (!run.generated_sql || connections.length === 0) return;
    const queryRes = await fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: connections[0].id, query: run.generated_sql }),
    });
    if (queryRes.ok) {
      const result = await queryRes.json();
      setActiveResult({ run, result });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runQuery(prompt);
    }
  }

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return JSON.stringify(value);
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return new Date(str).toLocaleString();
    return str;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Results area — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Run history */}
          {runs.map((run) => (
            <div key={run.id} className="space-y-2">
              {/* User prompt */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm max-w-lg">
                  {run.prompt}
                </div>
              </div>

              {/* Loading */}
              {run.loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                  Analyzing data and generating report...
                </div>
              )}

              {/* Error */}
              {run.error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {run.error}
                </div>
              )}

              {/* Success — clickable summary */}
              {!run.loading && !run.error && run.result_row_count > 0 && (
                <button
                  onClick={() => run.result ? setActiveResult({ run, result: run.result }) : rerunQuery(run)}
                  className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">{run.result_row_count} rows</span>
                      <span className="text-muted-foreground ml-2">
                        {run.result_columns.slice(0, 5).join(", ")}
                        {run.result_columns.length > 5 && ` +${run.result_columns.length - 5} more`}
                      </span>
                    </div>
                    {run.generated_sql && (
                      <span className="text-xs text-muted-foreground">Click to view</span>
                    )}
                  </div>
                </button>
              )}
            </div>
          ))}

          {/* Active result table */}
          {activeResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{activeResult.result.rowCount} rows</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setActiveResult(null)}>Close</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (activeResult.run.generated_sql) {
                      navigator.clipboard.writeText(activeResult.run.generated_sql);
                    }
                  }}>Copy SQL</Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs text-muted-foreground w-12">#</TableHead>
                        {activeResult.result.columns.map((col) => (
                          <TableHead key={col} className="text-xs font-semibold whitespace-nowrap px-4">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeResult.result.rows.map((row, i) => (
                        <TableRow key={i} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground w-12">{i + 1}</TableCell>
                          {activeResult.result.columns.map((col) => (
                            <TableCell key={col} className="text-sm whitespace-nowrap px-4">{formatCell(row[col])}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar at bottom */}
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          {connections.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-muted border shrink-0">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {connections[0]?.name}
            </span>
          )}
          <Input
            placeholder="Ask a follow-up question..."
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
