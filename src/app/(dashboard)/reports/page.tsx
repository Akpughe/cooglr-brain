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
}

export default function ReportsPage() {
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/reports/sessions").then((r) => r.json()).then(setSessions);
    fetch("/api/db/connections").then((r) => r.json()).then(setConnections);
  }, []);

  async function startReport() {
    if (!prompt.trim() || connections.length === 0) return;
    setLoading(true);
    setStatusText("Creating report session...");

    const res = await fetch("/api/reports/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: prompt.trim(), connectionId: connections[0].id }),
    });

    if (res.ok) {
      const session = await res.json();
      setStatusText("Redirecting...");
      router.push(`/reports/${session.id}?q=${encodeURIComponent(prompt.trim())}`);
    } else {
      setLoading(false);
      setStatusText(null);
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

          {hasConnections && !loading && (
            <div className="flex gap-2">
              <Input
                placeholder='e.g. "Show me the top 10 orders with customer details and order items"'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 h-12 text-base"
                autoFocus
              />
              <Button onClick={startReport} disabled={!prompt.trim()} className="h-12 px-6">
                Generate
              </Button>
            </div>
          )}

          {/* Loading transition */}
          {loading && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 text-sm max-w-lg">
                  {prompt}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-sm text-muted-foreground">{statusText}</span>
              </div>
              <div className="space-y-2 ml-6">
                <div className="h-3 bg-muted rounded-full animate-pulse w-4/5" />
                <div className="h-3 bg-muted rounded-full animate-pulse w-3/5" />
                <div className="h-3 bg-muted rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}
        </div>
      </div>

      {sessions.length > 0 && !loading && (
        <div className="border-t px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent Reports</p>
            <div className="space-y-1">
              {sessions.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/reports/${s.id}`)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors flex items-center justify-between group"
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
