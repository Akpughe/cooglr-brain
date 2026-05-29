"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, FileText, Mail, GitBranch, MessageSquare, HardDrive, Loader2, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

interface Connection { id: string; name: string }
interface ContentMap { documentCount: number; categories: { name: string; count: number }[] }

// Composio toolkits. `slug` matches Composio's connected-account toolkit slug.
const TOOLKITS = [
  { id: "gmail", slug: "gmail", name: "Gmail", Icon: Mail, ingestReady: true },
  { id: "github", slug: "github", name: "GitHub", Icon: GitBranch, ingestReady: false },
  { id: "slack", slug: "slack", name: "Slack", Icon: MessageSquare, ingestReady: false },
  { id: "google-drive", slug: "googledrive", name: "Google Drive", Icon: HardDrive, ingestReady: false },
];

export function IntegrationsTab({ workspaceId }: { workspaceId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [contentMap, setContentMap] = useState<ContentMap | null>(null);
  const [configured, setConfigured] = useState<string[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/db/connections?workspaceId=${workspaceId}`).then((r) => r.json()).then((d) => setConnections(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`/api/knowledge/content/map?workspaceId=${workspaceId}`).then((r) => r.json()).then((d) => setContentMap(d?.categories ? d : null)).catch(() => {});
    fetch(`/api/composio/connect`).then((r) => r.json()).then((d) => { setConfigured(d?.configured ?? []); setConnected(d?.connected ?? []); }).catch(() => {});
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]);

  async function post(url: string, body: Record<string, unknown>, label: string) {
    setBusy(label); setNote(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } catch (e) { setNote(e instanceof Error ? e.message : "Request failed"); return null; }
    finally { setBusy(null); }
  }

  async function buildMap(connectionId: string) {
    const d = await post("/api/knowledge/ingest", { workspaceId, connectionId }, `db:${connectionId}`);
    if (d) setNote(`Mapped ${d.tables} tables, ${d.metrics} metrics.`);
  }
  async function indexDocs() {
    const d = await post("/api/knowledge/content/ingest", { workspaceId }, "docs");
    if (d) { setNote(`Indexed ${d.ingested}/${d.files} files (${d.chunks} chunks).`); load(); }
  }
  async function connectApp(id: string) {
    const d = await post("/api/composio/connect", { toolkit: id }, `connect:${id}`);
    if (d?.redirectUrl) window.open(d.redirectUrl, "_blank", "noopener");
  }
  async function ingestApp(id: string) {
    const d = await post("/api/composio/ingest", { workspaceId, toolkit: id }, `ingest:${id}`);
    if (d) { setNote(`Ingested ${d.messages} items (${d.chunks} chunks).`); load(); }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Connect data sources so the workspace assistant can answer from them. Connected sources feed the same knowledge layer; ask questions from the home chat.</p>
      {note && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{note}</div>}

      {/* Databases */}
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Database className="h-4 w-4" /> Databases</div>
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No database connections yet. Add one in Reports, then build its map here.</p>
        ) : (
          <ul className="space-y-2">
            {connections.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <button onClick={() => buildMap(c.id)} disabled={busy === `db:${c.id}`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50">
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
          <button onClick={indexDocs} disabled={busy === "docs"} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50">
            {busy === "docs" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Index documents
          </button>
        </div>
        {contentMap && contentMap.documentCount > 0 ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>{contentMap.documentCount} documents indexed.</div>
            <div className="flex flex-wrap gap-1">{contentMap.categories.slice(0, 12).map((c) => <span key={c.name} className="rounded-full bg-muted px-2 py-0.5">{c.name} ({c.count})</span>)}</div>
          </div>
        ) : <p className="text-sm text-muted-foreground">No documents indexed yet.</p>}
      </div>

      {/* Connected apps */}
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" /> Connected apps</div>
        <ul className="space-y-2">
          {TOOLKITS.map(({ id, slug, name, Icon, ingestReady }) => {
            const isConfigured = configured.includes(id);
            const isConnected = connected.includes(slug);
            return (
              <li key={id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" /> {name}
                  {isConnected && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> connected</span>}
                  {!isConfigured && <span className="text-xs text-muted-foreground">(not configured)</span>}
                </span>
                {isConfigured && (
                  <span className="flex gap-1">
                    <button onClick={() => connectApp(id)} disabled={busy === `connect:${id}`} className="rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                      {busy === `connect:${id}` ? "…" : isConnected ? "Reconnect" : "Connect"}
                    </button>
                    {ingestReady ? (
                      <button onClick={() => ingestApp(id)} disabled={busy === `ingest:${id}`} className="rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                        {busy === `ingest:${id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ingest"}
                      </button>
                    ) : <span className="rounded-md px-2 py-1 text-xs text-muted-foreground">ingest soon</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Connect opens a consent window; after authorizing, click Ingest (Gmail today; other ingesters coming) to pull and understand the data.</p>
      </div>
    </div>
  );
}
