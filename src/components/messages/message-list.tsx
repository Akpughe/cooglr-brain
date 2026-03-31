"use client";

import { useEffect, useRef } from "react";
import { MessageItem } from "./message-item";
import { TypingIndicator } from "./typing-indicator";
import { useCurrentUserId } from "@/lib/workspace/context";
import type { Message } from "@/lib/messages/types";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  typingUsers: { userId: string; userName: string }[];
}

export function MessageList({ messages, loading, hasMore, onLoadMore, onEdit, onDelete, typingUsers }: MessageListProps) {
  const currentUserId = useCurrentUserId();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [loading]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop < 100) onLoadMore();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground">Be the first to send a message!</p>
        </div>
      </div>
    );
  }

  let lastDate = "";

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
      {hasMore && (
        <div className="text-center py-3">
          <button onClick={onLoadMore} className="text-xs text-muted-foreground hover:text-foreground">Load older messages</button>
        </div>
      )}
      {messages.map((msg) => {
        const msgDate = new Date(msg.createdAt).toLocaleDateString();
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;
        const dateLabel = isToday(msg.createdAt) ? "Today" : isYesterday(msg.createdAt) ? "Yesterday" : msgDate;

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground">{dateLabel}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <MessageItem message={msg} isOwn={msg.senderId === currentUserId} onEdit={onEdit} onDelete={onDelete} />
          </div>
        );
      })}
      <TypingIndicator typingUsers={typingUsers} />
      <div ref={bottomRef} />
    </div>
  );
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isYesterday(dateStr: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Date(dateStr).toDateString() === d.toDateString();
}
