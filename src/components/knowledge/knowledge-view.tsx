"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain, Database, FileText, Mail, Loader2, Sparkles, Plug, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface Connection { id: string; name: string }
interface ChartSpec { type: "bar" | "line" | "pie"; data: { name: string; value: number }[] }
interface AskResult {
  source: "database" | "content";
  answerMd: string;
  sql?: string;
  rowCount?: number;
  chart?: ChartSpec | null;
  citations?: { fileId: string; score: number }[];
}
interface ContentMap {
  documentCount: number;
  categories: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  entities: { name: string; count: number }[];
}

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

// Connectable apps. Gmail is fully wired (connect + ingest); others are staged.
const TOOLKITS: { id: string; name: string; ready: boolean }[] = [
  { id: "gmail", name: "Gmail", ready: true },
  { id: "google-drive", name: "Google Drive", ready: false },
  { id: "github", name: "GitHub", ready: false },
  { id: "slack", name: "Slack", ready: false },
];

export function KnowledgeView({ workspaceId }: { workspaceId: string }) {
  // --- Ask ---
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // --- Sources ---
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // which action is running
  const [note, setNote] = useState<string | null>(null);
  const [contentMap, setContentMap] = useState<ContentMap | null>(null);

  const loadSources = useCallback(() => {
    fetch(`/api/db/connections?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((d) => setConnections(Array.isArray(d) ? d : []))
      .catch(() => setConnections([]));
    fetch(`/api/knowledge/content/map?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((d) => setContentMap(d?.categories ? d : null))
      .catch(() => setContentMap(null));
  }, [workspaceId]);

  useEffect(() => { loadSources(); }, [loadSources]);

  async function post(url: string, body: Record<string, unknown>, label: string) {
    setBusy(label);
    setNote(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Request failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function buildDbMap(connectionId: string) {
    const d = await post("/api/knowledge/ingest", { workspaceId, connectionId }, `db:${connectionId}`);
    if (d) setNote(`Mapped ${d.tables} tables, ${d.metrics} metrics (${d.pages} pages).`);
  }
  async function indexDocs() {
    const d = await post("/api/knowledge/content/ingest", { workspaceId }, "docs");
    if (d) { setNote(`Indexed ${d.ingested}/${d.files} files (${d.chunks} chunks).`); loadSources(); }
  }
  async function connectApp(toolkit: string) {
    const d = await post("/api/composio/connect", { toolkit }, `connect:${toolkit}`);
    if (d?.redirectUrl) window.open(d.redirectUrl, "_blank", "noopener");
  }
  async function ingestApp(toolkit: string) {
    const d = await post("/api/composio/ingest", { workspaceId, toolkit }, `ingest:${toolkit}`);
    if (d) { setNote(`Ingested ${d.messages} messages (${d.chunks} chunks).`); loadSources(); }
  }

  async function ask() {
    if (!question.trim()) return;
    setAsking(true); setAskError(null); setResult(null);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Query failed");
      setResult(data as AskResult);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-lg font-semibold">Knowledge</h1>
          <p className="text-sm text-muted-foreground">Ask anything about your workspace&apos;s data — databases and documents, answered together.</p>
        </div>
      </header>

      {/* Ask */}
      <section className="space-y-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="e.g. how many signups last week? · what meetings do I have?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          />
          <button onClick={ask} disabled={asking || !question.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Ask
          </button>
        </div>
        {askError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{askError}</div>}
        {result && (
          <div className="space-y-3 rounded-lg border p-4">
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
              answered from {result.source === "database" ? "a database" : "documents"}
            </span>
            <p className="whitespace-pre-wrap text-sm">{result.answerMd}</p>
            {result.chart && result.chart.data.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {result.chart.type === "line" ? (
                    <LineChart data={result.chart.data}><XAxis dataKey="name" /><YAxis /><Tooltip /><Line dataKey="value" stroke="#6366f1" /></LineChart>
                  ) : result.chart.type === "pie" ? (
                    <PieChart><Tooltip /><Pie data={result.chart.data} dataKey="value" nameKey="name" outerRadius={90}>
                      {result.chart.data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie></PieChart>
                  ) : (
                    <BarChart data={result.chart.data}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#6366f1" /></BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
            {result.sql && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">SQL run ({result.rowCount} rows)</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2">{result.sql}</pre>
              </details>
            )}
            {result.citations && result.citations.length > 0 && (
              <p className="text-xs text-muted-foreground">{result.citations.length} source excerpts cited.</p>
            )}
          </div>
        )}
      </section>

      {note && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{note}</div>}

      {/* Sources */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Sources</h2>

        {/* Databases */}
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Database className="h-4 w-4" /> Databases</div>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No database connections. Add one in Reports, then build its map here.</p>
          ) : (
            <ul className="space-y-2">
              {connections.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <button onClick={() => buildDbMap(c.id)} disabled={busy === `db:${c.id}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                    {busy === `db:${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Build map
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Documents */}
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Documents (Files)</div>
            <button onClick={indexDocs} disabled={busy === "docs"}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50">
              {busy === "docs" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Index documents
            </button>
          </div>
          {contentMap && contentMap.documentCount > 0 ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>{contentMap.documentCount} documents indexed.</div>
              <div className="flex flex-wrap gap-1">
                {contentMap.categories.slice(0, 10).map((c) => (
                  <span key={c.name} className="rounded-full bg-muted px-2 py-0.5">{c.name} ({c.count})</span>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No documents indexed yet.</p>}
        </div>

        {/* Connected apps */}
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Plug className="h-4 w-4" /> Connected apps</div>
          <ul className="space-y-2">
            {TOOLKITS.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {t.id === "gmail" && <Mail className="h-4 w-4 text-muted-foreground" />}
                  {t.name}{!t.ready && <span className="text-xs text-muted-foreground">(coming soon)</span>}
                </span>
                {t.ready ? (
                  <span className="flex gap-1">
                    <button onClick={() => connectApp(t.id)} disabled={busy === `connect:${t.id}`}
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                      {busy === `connect:${t.id}` ? "…" : "Connect"}
                    </button>
                    <button onClick={() => ingestApp(t.id)} disabled={busy === `ingest:${t.id}`}
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                      {busy === `ingest:${t.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ingest"}
                    </button>
                  </span>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Connect opens a consent window; after authorizing, click Ingest to pull and understand the data.</p>
        </div>
      </section>
    </div>
  );
}
