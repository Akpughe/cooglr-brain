"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface TypingUser {
  userId: string;
  userName: string;
}

export function useTyping(targetId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`typing:${targetId}`);

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, userName } = payload.payload as TypingUser;
        if (userId === currentUserId) return;

        setTypingUsers((prev) => {
          if (prev.some((u) => u.userId === userId)) return prev;
          return [...prev, { userId, userName }];
        });

        const existing = typingTimeouts.current.get(userId);
        if (existing) clearTimeout(existing);

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
          typingTimeouts.current.delete(userId);
        }, 3000);

        typingTimeouts.current.set(userId, timeout);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      typingTimeouts.current.forEach((t) => clearTimeout(t));
      typingTimeouts.current.clear();
    };
  }, [targetId, currentUserId]);

  const sendTypingEvent = useCallback(
    (userName: string) => {
      const now = Date.now();
      if (now - lastSentRef.current < 2000) return;
      lastSentRef.current = now;

      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId, userName },
      });
    },
    [currentUserId]
  );

  return { typingUsers, sendTypingEvent };
}
