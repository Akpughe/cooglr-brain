"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ReportSession {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  is_active: boolean;
}

export default function ReportsPage() {
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/reports/sessions").then((r) => r.json()).then(setSessions);
    fetch("/api/db/connections").then((r) => r.json()).then((all: DbConnection[]) =>
      setConnections(all.filter((c) => c.is_active))
    );
  }, []);

  async function startReport() {
    if (!prompt.trim() || connections.length === 0) return;
    setLoading(true);
    const res = await fetch("/api/reports/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: prompt.trim(), connectionId: connections[0].id }),
    });
    if (res.ok) {
      const session = await res.json();
      router.push(`/reports/${session.id}?q=${encodeURIComponent(prompt.trim())}`);
    } else {
      setLoading(false);
    }
  }

  async function deleteSession(id: string) {
    await fetch("/api/reports/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); startReport(); }
  }

  const hasConnections = connections.length > 0;
  const filteredSessions = searchQuery
    ? sessions.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  // Group sessions by date
  const grouped = groupByDate(filteredSessions);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar — Report history */}
      <div className="w-[280px] border-r border-border bg-muted/20 flex flex-col shrink-0 h-full">
        {/* Header with data source indicator */}
        <div className="p-3 space-y-2 shrink-0 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Reports</h2>
            {connections.length > 0 && (
              <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {connections[0].name}
              </Badge>
            )}
          </div>
          {sessions.length > 5 && (
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg bg-background/50"
            />
          )}
        </div>

        {/* Session list grouped by date */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sessions.length === 0 && (
            <div className="text-center py-8 px-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">No reports yet.<br/>Ask a question to get started.</p>
            </div>
          )}
          {grouped.map(([label, items]) => (
            <div key={label} className="mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">{label}</p>
              <div className="space-y-0.5">
                {items.map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-center rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/reports/${s.id}`)}
                  >
                    <div className="flex-1 min-w-0 px-2.5 py-2">
                      <p className="text-[13px] text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {new Date(s.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Centered prompt area */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-xl space-y-6 text-center">
            {/* Icon + title */}
            <div>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">What would you like to know?</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Ask questions about your data in plain English</p>
            </div>

            {/* Data sources */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {connections.map((conn) => (
                <span key={conn.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-card border border-border shadow-warm">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {conn.name}
                  <span className="text-muted-foreground">({conn.db_type === "clickhouse" ? "ClickHouse" : "PostgreSQL"})</span>
                </span>
              ))}
              {!hasConnections && (
                <a href="/settings" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Connect a database
                </a>
              )}
            </div>

            {/* Input */}
            {hasConnections && (
              <div className={cn("relative", loading && "opacity-70 pointer-events-none")}>
                <Input
                  placeholder='e.g. "Show me the top 10 customers by revenue this month"'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="h-12 text-base rounded-2xl pl-5 pr-28 border-border bg-card shadow-warm focus-visible:shadow-warm-md transition-shadow"
                  autoFocus
                />
                <Button
                  onClick={startReport}
                  disabled={loading || !prompt.trim()}
                  className="absolute right-1.5 top-1.5 h-9 px-5 rounded-xl"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Starting
                    </span>
                  ) : "Generate"}
                </Button>
              </div>
            )}

            {/* Suggestion chips */}
            {hasConnections && !loading && (
              <div className="flex flex-wrap justify-center gap-2">
                {["Top 10 orders by revenue", "Monthly user signups", "Most popular products", "Active customers this week"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setPrompt(suggestion); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 hover:border-primary/20 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function groupByDate(sessions: { id: string; name: string; updated_at: string }[]): [string, typeof sessions][] {
  const groups: Record<string, typeof sessions> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  for (const s of sessions) {
    const d = new Date(s.updated_at);
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else if (d >= weekAgo) label = "This Week";
    else label = d.toLocaleDateString([], { month: "long", year: "numeric" });

    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  }

  return Object.entries(groups);
}
