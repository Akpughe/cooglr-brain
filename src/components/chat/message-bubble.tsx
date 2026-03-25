"use client";

import type { ChatMessage } from "@/types/gateway";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";

export function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <Streamdown
            plugins={{ code }}
            isAnimating={isStreaming}
          >
            {message.content}
          </Streamdown>
        )}
      </div>
    </div>
  );
}
