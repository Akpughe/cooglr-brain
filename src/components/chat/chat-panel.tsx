"use client";

import { useRef } from "react";
import { useGateway } from "@/hooks/use-gateway";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Badge } from "@/components/ui/badge";

interface Props {
  sessionId: string;
  onFirstMessage?: (message: string) => void;
}

export function ChatPanel({ sessionId, onFirstMessage }: Props) {
  const { messages, sendMessage, streaming, connected, statusText, processSteps, historyLoaded, elapsedMs } = useGateway(sessionId);
  const firstMessageSentRef = useRef(false);

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return seconds > 0 ? `${seconds}s` : "";
  };

  function handleSend(text: string) {
    if (!firstMessageSentRef.current && onFirstMessage) {
      firstMessageSentRef.current = true;
      onFirstMessage(text);
    }
    sendMessage(text);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-sm text-foreground">Chat</h2>
        <Badge
          variant={connected ? "secondary" : "destructive"}
          className="text-[10px] font-medium"
        >
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connected ? "bg-green-500" : "bg-red-500"}`} />
          {connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {/* Messages */}
      <MessageList messages={messages} historyLoaded={historyLoaded} streaming={streaming} />

      {/* Process steps */}
      {streaming && (processSteps.length > 0 || statusText) && (
        <div className="px-4 py-2.5 border-t border-border bg-muted/30 space-y-1 shrink-0">
          {processSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              {step.status === "running" ? (
                <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <span className="text-green-500 text-xs">&#10003;</span>
              )}
              <span>{step.label}</span>
              {step.status === "running" && elapsedMs > 0 && (
                <span className="text-[10px] text-muted-foreground/60">{formatElapsed(elapsedMs)}</span>
              )}
            </div>
          ))}
          {statusText && processSteps.every((s) => s.status === "done") && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>{statusText}</span>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={streaming} />
    </div>
  );
}
