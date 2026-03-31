"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePresence } from "@/hooks/use-presence";
import { useWorkspace, useCurrentUserId } from "@/lib/workspace/context";

interface PresenceContextValue {
  onlineUserIds: Set<string>;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set(),
  isOnline: () => false,
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { workspace, members } = useWorkspace();
  const currentUserId = useCurrentUserId();

  const currentMember = members.find((m) => m.userId === currentUserId);

  const { onlineUserIds, isOnline } = usePresence(workspace.id, {
    userId: currentUserId,
    fullName: currentMember?.fullName || "",
    avatarUrl: currentMember?.avatarUrl || null,
  });

  return (
    <PresenceContext.Provider value={{ onlineUserIds, isOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresenceContext() {
  return useContext(PresenceContext);
}
