"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/gateway";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4 max-w-4xl mx-auto">
        {!historyLoaded && (
          <div className="text-center text-muted-foreground mt-20">
            <p className="text-sm">Loading chat history...</p>
          </div>
        )}
        {historyLoaded && messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-20">
            <p className="text-lg font-medium">500Claw Platform</p>
            <p className="text-sm mt-1">Send a message to get started.</p>
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
    </ScrollArea>
  );
}
