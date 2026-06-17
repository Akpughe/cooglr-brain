"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/messages/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

function createOptimisticId() {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface UseMessagesOptions {
  targetId: string;
  type: "channel" | "dm";
  workspaceId: string;
  currentUserName?: string;
}

export function useMessages({ targetId, type, workspaceId, currentUserName }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load initial messages
  useEffect(() => {
    setLoading(true);
    setMessages([]);

    fetch(`/api/messages/${targetId}?type=${type}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setMessages((data.messages || []).reverse());
        setHasMore(data.hasMore ?? false);
      })
      .finally(() => setLoading(false));
  }, [targetId, type]);

  // Subscribe to realtime
  useEffect(() => {
    const supabase = createClient();
    const filterCol = type === "dm" ? "conversation_id" : "channel_id";

    const channel = supabase
      .channel(`messages:${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `${filterCol}=eq.${targetId}`,
        },
        (payload) => {
          // Fetch the full message with sender profile
          fetch(`/api/messages/${targetId}?type=${type}&limit=1`)
            .then((r) => r.json())
            .then((data) => {
              const newMsg = data.messages?.[0];
              if (newMsg) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  // Remove any optimistic messages and add the real one
                  const withoutOptimistic = prev.filter((m) => !m.id.startsWith("optimistic-"));
                  return [...withoutOptimistic, newMsg];
                });
              }
            });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `${filterCol}=eq.${targetId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? { ...m, content: updated.content, editedAt: updated.edited_at, attachments: updated.attachments || [] }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `${filterCol}=eq.${targetId}`,
        },
        (payload) => {
          const deleted = payload.old as any;
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [targetId, type]);

  const loadMore = useCallback(async () => {
    if (!hasMore || messages.length === 0) return;
    const oldest = messages[0];
    const res = await fetch(`/api/messages/${targetId}?type=${type}&limit=50&cursor=${oldest.createdAt}`);
    const data = await res.json();
    const olderMessages = (data.messages || []).reverse();
    setMessages((prev) => [...olderMessages, ...prev]);
    setHasMore(data.hasMore ?? false);
  }, [targetId, type, hasMore, messages]);

  const sendMessage = useCallback(
    async (content: string, attachments: any[] = []) => {
      // Optimistic: insert message immediately
      const optimisticId = createOptimisticId();
      const optimisticMessage: Message = {
        id: optimisticId,
        workspaceId,
        content,
        attachments: attachments || [],
        senderId: "optimistic",
        senderName: currentUserName || "You",
        senderAvatar: null,
        createdAt: new Date().toISOString(),
        editedAt: null,
        channelId: type === "channel" ? targetId : null,
        conversationId: type === "dm" ? targetId : null,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        await fetch(`/api/messages/${targetId}?type=${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, attachments, workspaceId }),
        });
        // Realtime subscription will replace the optimistic message with the real one.
        // Remove the optimistic message once the real one arrives (handled by the INSERT listener's dedup check).
      } catch {
        // Rollback: remove the optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [targetId, type, workspaceId, currentUserName]
  );

  const editMessage = useCallback(async (id: string, content: string) => {
    await fetch(`/api/messages/msg/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    await fetch(`/api/messages/msg/${id}`, { method: "DELETE" });
  }, []);

  return { messages, loading, hasMore, loadMore, sendMessage, editMessage, deleteMessage };
}
