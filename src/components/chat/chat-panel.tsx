"use client";

import { useRef } from "react";
import { useGateway } from "@/hooks/use-gateway";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";

interface Props {
  sessionId: string;
  onFirstMessage?: (message: string) => void;
}

export function ChatPanel({ sessionId, onFirstMessage }: Props) {
  const { messages, sendMessage, streaming, connected, statusText, processSteps, historyLoaded, elapsedMs } = useGateway(sessionId);
  const firstMessageSentRef = useRef(false);

  function handleSend(text: string) {
    if (!firstMessageSentRef.current && onFirstMessage) {
      firstMessageSentRef.current = true;
      onFirstMessage(text);
    }
    sendMessage(text);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <MessageList messages={messages} historyLoaded={historyLoaded} streaming={streaming} />

      {/* Thinking indicator */}
      {streaming && (processSteps.length > 0 || statusText) && (
        <div className="max-w-[720px] mx-auto w-full px-6">
          <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3 mb-2 space-y-1.5">
            {processSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                {step.status === "running" ? (
                  <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-primary/60 border-t-transparent animate-spin shrink-0" />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                <span>{step.label}</span>
                {step.status === "running" && elapsedMs > 0 && (
                  <span className="text-[10px] text-muted-foreground/40 tabular-nums ml-auto">
                    {Math.floor(elapsedMs / 1000)}s
                  </span>
                )}
              </div>
            ))}
            {statusText && processSteps.every((s) => s.status === "done") && (
              <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-primary/60 border-t-transparent animate-spin shrink-0" />
                <span>{statusText}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={streaming} connected={connected} />
    </div>
  );
}
