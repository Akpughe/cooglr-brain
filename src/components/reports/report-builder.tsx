"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  connection_id: string | null;
  query_text: string;
}

export function ReportBuilder() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportName, setReportName] = useState("");
  const [saved, setSaved] = useState<SavedReport[]>([]);

  useEffect(() => {
    fetch("/api/db/connections").then((r) => r.json()).then(setConnections);
    fetch("/api/reports").then((r) => r.json()).then(setSaved);
  }, []);

  async function runQuery() {
    if (!selectedDb || !query.trim()) return;
    setQuerying(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: selectedDb, query: query.trim() }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setResult(data);
    setQuerying(false);
  }

  async function saveReport() {
    if (!reportName.trim() || !query.trim()) return;
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: reportName, connectionId: selectedDb || null, queryText: query }),
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
      body: JSON.stringify({ title: reportName || "Report", columns: result.columns, rows: result.rows }),
    });
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, "_blank");
    else alert(data.error || "Export failed");
    setExporting(false);
  }

  async function loadSaved(report: SavedReport) {
    setQuery(report.query_text);
    if (report.connection_id) setSelectedDb(report.connection_id);
    setReportName(report.name);
  }

  async function deleteSaved(id: string) {
    await fetch("/api/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSaved((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      {saved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {saved.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadSaved(r)}>Load</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteSaved(r.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <CardDescription>Select a database, write a query, and generate a report.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={selectedDb} onValueChange={(v) => v && setSelectedDb(v)}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select database..." />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Report name" value={reportName} onChange={(e) => setReportName(e.target.value)} className="flex-1" />
          </div>

          <Textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SELECT * FROM users LIMIT 10" className="font-mono text-sm" rows={4} />

          <div className="flex gap-2">
            <Button onClick={runQuery} disabled={querying || !selectedDb || !query.trim()}>
              {querying ? "Running..." : "Run Query"}
            </Button>
            {result && (
              <>
                <Button variant="outline" onClick={saveReport} disabled={!reportName.trim()}>Save Report</Button>
                <Button variant="outline" onClick={exportToSheets} disabled={exporting}>
                  {exporting ? "Exporting..." : "Export to Google Sheets"}
                </Button>
              </>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((col) => (
                      <TableHead key={col} className="font-mono text-xs">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={i}>
                      {result.columns.map((col) => (
                        <TableCell key={col} className="font-mono text-xs">{String(row[col] ?? "NULL")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-2 text-xs text-muted-foreground border-t">{result.rowCount} rows</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
