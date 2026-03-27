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
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!historyLoaded && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Loading chat history...
            </div>
          </div>
        )}
        {historyLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-base font-medium text-foreground">Start a conversation</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Ask me anything — schedule meetings, generate reports, manage tickets, or just chat.
            </p>
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
