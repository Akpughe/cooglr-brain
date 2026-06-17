"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  connected?: boolean;
}

export function MessageInput({ onSend, disabled, connected = true }: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasContent = value.trim().length > 0;

  return (
    <div className="px-6 pb-5 pt-2 shrink-0">
      <div className="max-w-[720px] mx-auto">
        <div className={cn(
          "relative rounded-2xl border bg-card transition-all duration-200",
          focused
            ? "border-primary/30 shadow-surface-md"
            : "border-border shadow-surface"
        )}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Message 500Claw..."
            className="w-full resize-none bg-transparent pl-4 pr-14 py-3.5 text-[14px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none min-h-[52px] max-h-[180px]"
            rows={1}
            disabled={disabled}
          />

          {/* Send button — absolutely positioned */}
          <div className="absolute right-2.5 bottom-2.5">
            <button
              onClick={handleSend}
              disabled={disabled || !hasContent}
              aria-label="Send message"
              className={cn(
                "flex items-center justify-center size-8 rounded-xl transition-all duration-200",
                hasContent && !disabled
                  ? "bg-primary text-primary-foreground shadow-surface hover:bg-primary/90 scale-100"
                  : "bg-transparent text-muted-foreground/30 scale-95"
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-emerald-500" : "bg-red-400"
            )} />
            <span className="text-[10px] text-muted-foreground/40">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/30">
            Enter to send
          </span>
        </div>
      </div>
    </div>
  );
}
