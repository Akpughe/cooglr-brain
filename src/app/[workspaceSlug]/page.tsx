"use client";

import { useWorkspace } from "@/lib/workspace/context";

export default function AIHomePage() {
  const { workspace } = useWorkspace();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">What&apos;s on the agenda?</h1>

        <div className="border border-border rounded-xl p-4 bg-card">
          <input
            type="text"
            placeholder="Ask anything"
            className="w-full bg-transparent text-sm focus:outline-none"
          />
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">
              {workspace.name}
            </span>
            <button className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1">
              Attach
            </button>
            <button className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1">
              Mention
            </button>
          </div>
        </div>

        <div className="space-y-1 text-left max-w-lg mx-auto">
          {[
            "What should I work on today?",
            "Check my recent emails",
            "Summarize my upcoming calendar events",
            "What should I focus on this week?",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border-b border-border last:border-0"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
