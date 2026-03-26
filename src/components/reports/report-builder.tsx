"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  connection_id: string | null;
  query_text: string;
}

export function ReportBuilder() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<DbConnection | null>(null);
  const [schemaLoaded, setSchemaLoaded] = useState(false);
  const [tableCount, setTableCount] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [reportName, setReportName] = useState("");
  const [showSQL, setShowSQL] = useState(false);

  useEffect(() => {
    fetch("/api/db/connections").then((r) => r.json()).then((data) => {
      setConnections(data);
      if (data.length === 1) selectConnection(data[0]);
    });
    fetch("/api/reports").then((r) => r.json()).then(setSaved);
  }, []);

  const selectConnection = useCallback(async (conn: DbConnection) => {
    setActiveConnection(conn);
    setSchemaLoaded(false);
    try {
      const res = await fetch(`/api/db/schema?connectionId=${conn.id}`);
      if (res.ok) {
        const tables = await res.json();
        setTableCount(tables.length);
      }
    } catch { /* ignore */ }
    setSchemaLoaded(true);
  }, []);

  async function generateAndRun() {
    if (!activeConnection || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setGeneratedSQL(null);

    try {
      const aiRes = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          connectionId: activeConnection.id,
          dbType: activeConnection.db_type,
        }),
      });

      if (!aiRes.ok) {
        const err = await aiRes.json();
        setError(err.error || "Failed to generate query");
        setLoading(false);
        return;
      }

      const { sql } = await aiRes.json();
      setGeneratedSQL(sql);

      const queryRes = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: activeConnection.id, query: sql }),
      });

      const data = await queryRes.json();
      if (!queryRes.ok) setError(data.error || "Query failed");
      else setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setLoading(false);
  }

  async function runSavedReport(report: SavedReport) {
    if (!report.connection_id) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setGeneratedSQL(report.query_text);
    setPrompt(report.description || report.name);

    const conn = connections.find((c) => c.id === report.connection_id);
    if (conn) setActiveConnection(conn);

    const res = await fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: report.connection_id, query: report.query_text }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setResult(data);
    setLoading(false);
  }

  async function saveReport() {
    if (!reportName.trim() || !generatedSQL || !activeConnection) return;
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: reportName,
        description: prompt,
        connectionId: activeConnection.id,
        queryText: generatedSQL,
      }),
    });
    if (res.ok) {
      const report = await res.json();
      setSaved((prev) => [report, ...prev]);
      setReportName("");
    }
  }

  async function exportToSheets() {
    if (!result) return;
    setExporting(true);
    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: reportName || prompt || "Report",
        columns: result.columns,
        rows: result.rows,
      }),
    });
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, "_blank");
    else alert(data.error || "Export failed");
    setExporting(false);
  }

  async function deleteReport(id: string) {
    await fetch("/api/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSaved((prev) => prev.filter((r) => r.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      generateAndRun();
    }
  }

  const hasConnections = connections.length > 0;

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === "object") return JSON.stringify(value);
    const str = String(value);
    // Format ISO dates nicely
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      return new Date(str).toLocaleString();
    }
    return str;
  }

  return (
    <div className="space-y-6">
      {/* Top section — centered like the page title */}
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Data Source Indicator */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Data Sources:</span>
          {!hasConnections && (
            <span className="text-xs text-muted-foreground">
              No databases connected. <a href="/settings" className="text-primary hover:underline">Add one in Settings</a>
            </span>
          )}
          {connections.map((conn) => (
            <button
              key={conn.id}
              onClick={() => selectConnection(conn)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
                activeConnection?.id === conn.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-accent border-border"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {conn.name}
            </button>
          ))}
          {schemaLoaded && tableCount > 0 && (
            <span className="text-xs text-muted-foreground">{tableCount} tables</span>
          )}
        </div>

        {/* Ask in plain English */}
        {hasConnections && (
          <div className="flex gap-2">
            <Input
              placeholder='Ask anything... e.g. "Show me the top 10 customers by order count"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !activeConnection}
              className="flex-1 h-11"
            />
            <Button onClick={generateAndRun} disabled={loading || !activeConnection || !prompt.trim()} className="h-11 px-6">
              {loading ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Saved Reports */}
        {saved.length > 0 && !result && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Saved Reports</p>
            {saved.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{r.name}</p>
                  {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                </div>
                <div className="flex gap-2 ml-2">
                  <Button size="sm" variant="outline" onClick={() => runSavedReport(r)}>Run</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteReport(r.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results — full width */}
      {result && (
        <div className="space-y-3">
          {/* Actions bar */}
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{result.rowCount} rows</span>
              {generatedSQL && (
                <button
                  onClick={() => setShowSQL(!showSQL)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <span>{showSQL ? "▼" : "▶"}</span>
                  <span>SQL</span>
                </button>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Report name..."
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-44 h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={saveReport} disabled={!reportName.trim()}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={exportToSheets} disabled={exporting}>
                {exporting ? "Exporting..." : "Export to Sheets"}
              </Button>
            </div>
          </div>

          {/* SQL preview */}
          {showSQL && generatedSQL && (
            <div className="max-w-4xl mx-auto">
              <pre className="p-3 bg-muted rounded-lg overflow-x-auto text-xs font-mono">
                {generatedSQL}
              </pre>
            </div>
          )}

          {/* Full-width table */}
          <div className="border rounded-lg overflow-hidden mx-2">
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs text-muted-foreground w-12">#</TableHead>
                    {result.columns.map((col) => (
                      <TableHead key={col} className="text-xs font-semibold whitespace-nowrap px-4">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground w-12">{i + 1}</TableCell>
                      {result.columns.map((col) => (
                        <TableCell key={col} className="text-sm whitespace-nowrap px-4">
                          {formatCell(row[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
