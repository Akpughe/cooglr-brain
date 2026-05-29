"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace/context";
import { Paperclip, AtSign, ArrowUp, History, ChevronDown, Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface ChartSpec { type: "bar" | "line" | "pie"; data: { name: string; value: number }[] }
interface AskResult {
  source: "database" | "content";
  answerMd: string;
  sql?: string;
  rowCount?: number;
  chart?: ChartSpec | null;
  citations?: { fileId: string; score: number }[];
  origins?: string[];
}
interface Turn { question: string; result?: AskResult; error?: string }

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];
const SUGGESTIONS = [
  "What should I work on today?",
  "Check my recent emails",
  "Summarize my upcoming calendar events",
  "What should I focus on this week?",
];

export default function AIHomePage() {
  const { workspace } = useWorkspace();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || asking) return;
    setQuestion("");
    setAsking(true);
    const idx = turns.length;
    setTurns((t) => [...t, { question: query }]);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, question: query }),
      });
      const data = await res.json();
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, result: res.ok ? data : undefined, error: res.ok ? undefined : (data.error || "Query failed") } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, error: e instanceof Error ? e.message : "Query failed" } : x)));
    } finally {
      setAsking(false);
    }
  }

  const started = turns.length > 0;

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6">
      <button aria-label="Chat history" className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
        <History className="size-4" />
      </button>

      <div className={`w-full max-w-2xl space-y-6 ${started ? "py-10" : "flex flex-1 flex-col justify-center text-center"}`}>
        {!started && <h1 className="text-2xl font-semibold tracking-tight">What&apos;s on the agenda?</h1>}

        {/* Conversation */}
        {turns.map((t, i) => (
          <div key={i} className="space-y-3 text-left">
            <div className="flex justify-end">
              <span className="rounded-2xl bg-muted px-3 py-2 text-sm">{t.question}</span>
            </div>
            {t.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{t.error}</div>}
            {t.result && (
              <div className="space-y-3 rounded-lg border bg-card p-4 shadow-surface">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  answered from {t.result.origins?.length ? t.result.origins.join(" & ") : (t.result.source === "database" ? "a database" : "documents")}
                </span>
                <div className="text-sm leading-relaxed [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold">
                  <Streamdown>{t.result.answerMd}</Streamdown>
                </div>
                {t.result.chart && t.result.chart.data.length > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {t.result.chart.type === "line" ? (
                        <LineChart data={t.result.chart.data}><XAxis dataKey="name" /><YAxis /><Tooltip /><Line dataKey="value" stroke="#6366f1" /></LineChart>
                      ) : t.result.chart.type === "pie" ? (
                        <PieChart><Tooltip /><Pie data={t.result.chart.data} dataKey="value" nameKey="name" outerRadius={90}>
                          {t.result.chart.data.map((_, k) => <Cell key={k} fill={PIE_COLORS[k % PIE_COLORS.length]} />)}</Pie></PieChart>
                      ) : (
                        <BarChart data={t.result.chart.data}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#6366f1" /></BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
                {t.result.sql && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">SQL run ({t.result.rowCount} rows)</summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-muted p-2">{t.result.sql}</pre>
                  </details>
                )}
                {t.result.citations && t.result.citations.length > 0 && (
                  <p className="text-xs text-muted-foreground">{t.result.citations.length} source excerpts cited.</p>
                )}
              </div>
            )}
          </div>
        ))}

        {asking && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</div>}

        {/* Input card */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-surface">
          <textarea
            rows={2}
            placeholder="Ask anything..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(question); } }}
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <span className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {workspace.name}<ChevronDown className="size-3" />
            </span>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground" title="Attach (coming soon)">
              <Paperclip className="size-3.5" />Attach
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground" title="Mention (coming soon)">
              <AtSign className="size-3.5" />Mention
            </button>
            <div className="flex-1" />
            <button aria-label="Send" onClick={() => ask(question)} disabled={asking || !question.trim()}
              className="flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-opacity duration-150 hover:opacity-80 disabled:opacity-40">
              {asking ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>

        {/* Suggestions (only before first message) */}
        {!started && (
          <div className="mx-auto max-w-lg text-left">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)}
                className="w-full border-b border-border px-4 py-4 text-left text-sm text-muted-foreground transition-colors duration-150 last:border-b-0 hover:bg-muted/50 hover:text-foreground">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
