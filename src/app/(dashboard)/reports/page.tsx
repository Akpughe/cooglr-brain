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
    <div className="flex flex-col h-full bg-[#faf8f5]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl space-y-6">
          {/* Title area with warm gradient hint */}
          <div className="text-center space-y-2 relative">
            <div className="absolute inset-0 -mx-12 -my-8 rounded-2xl bg-gradient-to-b from-orange-50/60 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-center gap-2.5">
              <svg className="w-7 h-7 text-[#c2410c]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            </div>
            <p className="text-muted-foreground relative">Ask a question about your data in plain English</p>
          </div>

          {/* Data source pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {connections.map((conn) => (
              <span
                key={conn.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-[#c2410c] text-white font-medium"
              >
                <span className="w-2 h-2 rounded-full bg-green-300" />
                {conn.name}
              </span>
            ))}
            {!hasConnections && (
              <span className="text-xs text-muted-foreground">
                No databases connected.{" "}
                <a href="/settings" className="text-[#c2410c] hover:underline font-medium">
                  Add one in Settings
                </a>
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
                className="flex-1 h-12 text-base rounded-xl border-[#e7e0d5] bg-white focus-visible:ring-[#c2410c]/30"
                autoFocus
              />
              <Button
                onClick={startReport}
                disabled={loading || !prompt.trim()}
                className="h-12 px-6 rounded-xl bg-[#c2410c] hover:bg-[#a83509] text-white"
              >
                {loading ? "Starting..." : "Generate"}
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!hasConnections && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f5f2ed] flex items-center justify-center">
                <svg className="w-7 h-7 text-[#c2410c]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Connect a database to start querying your data with plain English questions.
              </p>
            </div>
          )}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="border-t border-[#e7e0d5] px-6 py-4 bg-[#faf8f5]">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent Reports</p>
            <div className="space-y-1">
              {sessions.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/reports/${s.id}`)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#f5f2ed]/50 transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm truncate text-foreground group-hover:text-[#c2410c] transition-colors">{s.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-3">{new Date(s.updated_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
