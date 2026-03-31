"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/messages/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseMessagesOptions {
  targetId: string;
  type: "channel" | "dm";
  workspaceId: string;
}

export function useMessages({ targetId, type, workspaceId }: UseMessagesOptions) {
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
                  return [...prev, newMsg];
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
      await fetch(`/api/messages/${targetId}?type=${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments, workspaceId }),
      });
    },
    [targetId, type, workspaceId]
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
