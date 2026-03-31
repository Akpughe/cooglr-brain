"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceState {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  onlineAt: string;
}

export function usePresence(
  workspaceId: string,
  currentUser: { userId: string; fullName: string; avatarUrl: string | null }
) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:workspace:${workspaceId}`, {
      config: { presence: { key: currentUser.userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const ids = new Set<string>();
        for (const key of Object.keys(state)) {
          ids.add(key);
        }
        setOnlineUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: currentUser.userId,
            fullName: currentUser.fullName,
            avatarUrl: currentUser.avatarUrl,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [workspaceId, currentUser.userId, currentUser.fullName, currentUser.avatarUrl]);

  const isOnline = useCallback(
    (userId: string) => onlineUserIds.has(userId),
    [onlineUserIds]
  );

  return { onlineUserIds, isOnline };
}
