"use client";

import { useGateway } from "@/hooks/use-gateway";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Badge } from "@/components/ui/badge";

export function ChatPanel() {
  const { messages, sendMessage, streaming, connected, statusText, processSteps, historyLoaded, elapsedMs } = useGateway();

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return seconds > 0 ? `${seconds}s` : "";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <h2 className="font-semibold">Chat</h2>
        <Badge variant={connected ? "default" : "destructive"}>
          {connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>
      <MessageList messages={messages} historyLoaded={historyLoaded} streaming={streaming} />

      {/* Process steps / thinking indicator */}
      {streaming && (processSteps.length > 0 || statusText) && (
        <div className="px-4 py-3 border-t bg-muted/30 space-y-1">
          {processSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              {step.status === "running" ? (
                <span className="inline-block w-3 h-3 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
              ) : (
                <span className="inline-block w-3 h-3 text-green-500">&#10003;</span>
              )}
              <span>{step.label}</span>
              {step.status === "running" && elapsedMs > 0 && (
                <span className="text-[10px] text-muted-foreground/60">{formatElapsed(elapsedMs)}</span>
              )}
            </div>
          ))}
          {statusText && processSteps.every((s) => s.status === "done") && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
              <span>{statusText}</span>
            </div>
          )}
        </div>
      )}

      <MessageInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
