"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace, useCurrentUserId } from "@/lib/workspace/context";
import { usePresenceContext } from "@/lib/messages/presence-context";
import { Plus, Hash } from "lucide-react";
import { CreateChannelModal } from "./create-channel-modal";
import { NewDmPicker } from "./new-dm-picker";
import Link from "next/link";
import type { Channel, DirectConversation } from "@/lib/messages/types";
import { cn } from "@/lib/utils";

export function MessagesSidebarContent() {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const currentUserId = useCurrentUserId();
  const { isOnline } = usePresenceContext();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);

  const workspaceBase = `/${workspace.slug}/messages`;

  useEffect(() => {
    fetch(`/api/messages/channels?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []));

    fetch(`/api/messages/conversations?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []));
  }, [workspace.id]);

  function isActive(path: string) { return pathname === path; }

  return (
    <>
      <div className="mb-3">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--sidebar-text-muted)" }}>Channels</span>
          <button onClick={() => setShowCreateChannel(true)} aria-label="Create channel" className="size-5 rounded flex items-center justify-center transition-colors" style={{ color: "var(--sidebar-text-muted)" }}>
            <Plus className="size-3.5" />
          </button>
        </div>
        <div className="space-y-px">
          {channels.map((ch) => {
            const path = `${workspaceBase}/c/${ch.id}`;
            const active = isActive(path);
            return (
              <Link key={ch.id} href={path}
                className={cn("flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md text-[13px] transition-colors", active ? "font-medium" : "")}
                style={{ color: active ? "var(--sidebar-text)" : "var(--sidebar-text-muted)", background: active ? "var(--sidebar-hover)" : "transparent" }}>
                <Hash className="size-3.5 shrink-0 opacity-50" />
                {ch.name}
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--sidebar-text-muted)" }}>Direct Messages</span>
          <button onClick={() => setShowNewDm(true)} aria-label="New direct message" className="size-5 rounded flex items-center justify-center transition-colors" style={{ color: "var(--sidebar-text-muted)" }}>
            <Plus className="size-3.5" />
          </button>
        </div>
        <div className="space-y-px">
          {conversations.map((convo) => {
            const path = `${workspaceBase}/dm/${convo.id}`;
            const active = isActive(path);
            const other = convo.otherUser;
            return (
              <Link key={convo.id} href={path}
                className={cn("flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md text-[13px] transition-colors", active ? "font-medium" : "")}
                style={{ color: active ? "var(--sidebar-text)" : "var(--sidebar-text-muted)", background: active ? "var(--sidebar-hover)" : "transparent" }}>
                <div className="relative shrink-0">
                  <div className="size-5 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
                    {other.fullName?.[0]?.toUpperCase() || other.email[0].toUpperCase()}
                  </div>
                  {isOnline(other.id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success border border-[var(--sidebar-bg)]" />
                  )}
                </div>
                <span className="truncate">{other.fullName || other.email}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {showCreateChannel && (
        <CreateChannelModal workspaceId={workspace.id} onClose={() => setShowCreateChannel(false)}
          onCreate={(channel) => { setChannels((prev) => [...prev, channel]); setShowCreateChannel(false); }} />
      )}
      {showNewDm && <NewDmPicker workspaceId={workspace.id} workspaceSlug={workspace.slug} onClose={() => setShowNewDm(false)} />}
    </>
  );
}
