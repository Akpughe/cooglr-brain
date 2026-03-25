"use client";

import { useGateway } from "@/hooks/use-gateway";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Badge } from "@/components/ui/badge";

export function ChatPanel() {
  const { messages, sendMessage, streaming, connected, statusText, historyLoaded } = useGateway();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Chat</h2>
          {statusText && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {statusText}
            </span>
          )}
        </div>
        <Badge variant={connected ? "default" : "destructive"}>
          {connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>
      <MessageList messages={messages} historyLoaded={historyLoaded} streaming={streaming} />
      <MessageInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
