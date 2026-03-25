"use client";

import { useGateway } from "@/hooks/use-gateway";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Badge } from "@/components/ui/badge";

export function ChatPanel() {
  const { messages, sendMessage, streaming, connected } = useGateway();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <h2 className="font-semibold">Chat</h2>
        <Badge variant={connected ? "default" : "destructive"}>
          {connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
