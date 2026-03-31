"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { Sparkles, Paperclip, AtSign, ArrowUp, History, ChevronDown } from "lucide-react";

export default function AIHomePage() {
  const { workspace } = useWorkspace();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
      {/* History button */}
      <button
        className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
        title="Chat history"
      >
        <History className="w-4 h-4" />
      </button>

      <div className="w-full max-w-2xl space-y-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">What&apos;s on the agenda?</h1>

        {/* Input card */}
        <div className="border border-border rounded-2xl p-5 bg-card shadow-sm">
          <textarea
            rows={2}
            placeholder="Ask anything..."
            className="w-full bg-transparent text-sm focus:outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <span className="text-xs px-2.5 py-1 bg-muted rounded-lg text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors duration-150">
              {workspace.name}
              <ChevronDown className="w-3 h-3" />
            </span>
            <button className="text-xs px-2.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors duration-150">
              <Paperclip className="w-3.5 h-3.5" />
              Attach
            </button>
            <button className="text-xs px-2.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors duration-150">
              <AtSign className="w-3.5 h-3.5" />
              Mention
            </button>
            <div className="flex-1" />
            <button className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity duration-150">
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Suggestions */}
        <div className="text-left max-w-lg mx-auto">
          {[
            "What should I work on today?",
            "Check my recent emails",
            "Summarize my upcoming calendar events",
            "What should I focus on this week?",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="w-full text-left px-4 py-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 border-b border-border last:border-b-0"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
