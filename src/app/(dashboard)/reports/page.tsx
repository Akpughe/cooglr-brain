"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const router = useRouter();

  useEffect(() => {
    fetch("/api/reports/sessions").then((r) => r.json()).then(setSessions);
    fetch("/api/db/connections").then((r) => r.json()).then((all: DbConnection[]) => setConnections(all.filter((c) => c.is_active)));
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
      // Don't reset loading — let navigation handle it
    } else {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); startReport(); }
  }

  const hasConnections = connections.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground">Ask a question about your data in plain English</p>
          </div>

          <div className="flex items-center justify-center gap-2">
            {connections.map((conn) => (
              <span key={conn.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {conn.name}
              </span>
            ))}
            {!hasConnections && (
              <span className="text-xs text-muted-foreground">
                No databases connected. <a href="/settings" className="text-primary hover:underline">Add one in Settings</a>
              </span>
            )}
          </div>

          {hasConnections && (
            <div className="flex gap-2">
              <Input
                placeholder='e.g. "Show me the top 10 orders with customer details and order items"'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="flex-1 h-12 text-base"
                autoFocus
              />
              <Button onClick={startReport} disabled={loading || !prompt.trim()} className="h-12 px-6">
                {loading ? "Starting..." : "Generate"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="border-t px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent Reports</p>
            <div className="space-y-1">
              {sessions.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/reports/${s.id}`)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors flex items-center justify-between"
                >
                  <span className="text-sm truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(s.updated_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
