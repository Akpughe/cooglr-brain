"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Database, Loader2, Sparkles } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface Connection { id: string; name: string }
interface MapPage { id: string; path: string; type: string; title: string }
interface ChartSpec { type: "bar" | "line" | "pie"; data: { name: string; value: number }[] }
interface QueryOutcome {
  answerMd: string;
  chart: ChartSpec | null;
  dig: { sql?: string; rowCount: number };
  plan: { pagePaths: string[] };
}

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

export function KnowledgeView({ workspaceId }: { workspaceId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [pages, setPages] = useState<MapPage[]>([]);
  const [building, setBuilding] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [outcome, setOutcome] = useState<QueryOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/db/connections?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        const list: Connection[] = Array.isArray(data) ? data : [];
        setConnections(list);
        if (list.length > 0) setConnectionId(list[0].id);
      })
      .catch(() => setConnections([]));
  }, [workspaceId]);

  const loadPages = useCallback(() => {
    if (!connectionId) return;
    fetch(`/api/knowledge/pages?workspaceId=${workspaceId}&connectionId=${connectionId}`)
      .then((r) => r.json())
      .then((d) => setPages(d.pages ?? []))
      .catch(() => setPages([]));
  }, [workspaceId, connectionId]);

  useEffect(() => { loadPages(); }, [loadPages]);

  async function buildMap() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, connectionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed");
      loadPages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    setOutcome(null);
    try {
      const res = await fetch("/api/knowledge/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, connectionId, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Query failed");
      setOutcome(data as QueryOutcome);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-lg font-semibold">Knowledge</h1>
          <p className="text-sm text-muted-foreground">A map of your data. Ask in plain language; answers are dug live.</p>
        </div>
      </header>

      {connections.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Connect a database in Reports first, then build its knowledge map here.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-muted-foreground" />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={buildMap}
              disabled={building || !connectionId}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {pages.length > 0 ? "Rebuild map" : "Build map"}
            </button>
          </div>

          {pages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {pages.length} map pages — {pages.filter((p) => p.type === "table").length} tables,{" "}
              {pages.filter((p) => p.type === "metric").length} metrics,{" "}
              {pages.filter((p) => p.type === "relationship").length} relationships.
            </p>
          )}

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="e.g. how many signups last week?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              disabled={pages.length === 0}
            />
            <button
              onClick={ask}
              disabled={asking || pages.length === 0 || !question.trim()}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
            </button>
          </div>

          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {outcome && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="whitespace-pre-wrap text-sm">{outcome.answerMd}</p>
              {outcome.chart && outcome.chart.data.length > 0 && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {outcome.chart.type === "line" ? (
                      <LineChart data={outcome.chart.data}>
                        <XAxis dataKey="name" /><YAxis /><Tooltip />
                        <Line dataKey="value" stroke="#6366f1" />
                      </LineChart>
                    ) : outcome.chart.type === "pie" ? (
                      <PieChart>
                        <Tooltip />
                        <Pie data={outcome.chart.data} dataKey="value" nameKey="name" outerRadius={90}>
                          {outcome.chart.data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                    ) : (
                      <BarChart data={outcome.chart.data}>
                        <XAxis dataKey="name" /><YAxis /><Tooltip />
                        <Bar dataKey="value" fill="#6366f1" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
              {outcome.dig.sql && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">SQL run ({outcome.dig.rowCount} rows)</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-2">{outcome.dig.sql}</pre>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
