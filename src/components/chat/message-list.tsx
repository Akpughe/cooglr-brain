"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/gateway";
import { MessageBubble } from "./message-bubble";

export function MessageList({
  messages,
  historyLoaded,
  streaming,
}: {
  messages: ChatMessage[];
  historyLoaded: boolean;
  streaming?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-[720px] mx-auto px-6 py-8 space-y-5">
        {!historyLoaded && (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <div className="w-5 h-5 rounded-full border-[1.5px] border-primary border-t-transparent animate-spin" />
            <p className="text-[13px] text-muted-foreground/60">Loading...</p>
          </div>
        )}

        {historyLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-medium text-foreground tracking-[-0.02em]">
              How can I help?
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-[360px] leading-relaxed">
              I can generate reports, manage tickets, draft emails, analyze your data, or help with code.
            </p>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-[440px]">
              {[
                "Show me last month's revenue",
                "List open tickets",
                "Draft a status update",
                "Analyze recent PRs",
              ].map((s) => (
                <span
                  key={s}
                  className="text-[12px] text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted/40 hover:border-primary/20 transition-all duration-150 cursor-default"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
