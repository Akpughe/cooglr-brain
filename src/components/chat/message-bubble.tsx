"use client";

import type { ChatMessage } from "@/types/gateway";
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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-lg bg-primary text-primary-foreground rounded-[20px] rounded-br-[4px] px-4 py-2.5 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  // AI response — full width, no bubble
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">
        AI
      </div>
      <div className="flex-1 min-w-0 text-sm leading-relaxed">
        <Streamdown
          plugins={{ code }}
          isAnimating={isStreaming}
        >
          {message.content}
        </Streamdown>
      </div>
    </div>
  );
}
