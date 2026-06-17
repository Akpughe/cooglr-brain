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
        <div className="max-w-[520px] rounded-2xl rounded-br-lg bg-primary text-primary-foreground px-4 py-3 text-[14px] leading-[1.6] whitespace-pre-wrap shadow-surface">
          {message.content}
        </div>
      </div>
    );
  }

  // AI message — left-aligned, full width, with avatar
  return (
    <div className="flex gap-3">
      <div className="size-7 rounded-[8px] bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-primary">AI</span>
      </div>
      <div className="flex-1 min-w-0 text-[14px] leading-[1.75] text-foreground/90 pt-0.5">
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
