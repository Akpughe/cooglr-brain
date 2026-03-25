"use client";

import { useGateway } from "@/hooks/use-gateway";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Badge } from "@/components/ui/badge";

export function ChatPanel() {
  const { messages, sendMessage, streaming, connected, thinking, toolActivity, historyLoaded } = useGateway();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <h2 className="font-semibold">Chat</h2>
        <Badge variant={connected ? "default" : "destructive"}>
          {connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>
      <MessageList messages={messages} historyLoaded={historyLoaded} />

      {/* Thinking / Tool activity indicator */}
      {(thinking || toolActivity) && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
            </span>
            <span>{toolActivity || "Thinking..."}</span>
          </div>
        </div>
      )}

      <MessageInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
