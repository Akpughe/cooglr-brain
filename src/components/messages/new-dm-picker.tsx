"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, useCurrentUserId } from "@/lib/workspace/context";
import { usePresenceContext } from "@/lib/messages/presence-context";
import { X, Search } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface NewDmPickerProps {
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
}

export function NewDmPicker({ workspaceId, workspaceSlug, onClose }: NewDmPickerProps) {
  const router = useRouter();
  const { members } = useWorkspace();
  const currentUserId = useCurrentUserId();
  const { isOnline } = usePresenceContext();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredMembers = members
    .filter((m) => m.userId !== currentUserId)
    .filter((m) => !search || m.fullName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));

  async function handleSelect(otherUserId: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, otherUserId }),
      });
      const data = await res.json();
      if (data.conversation) { onClose(); router.push(`/${workspaceSlug}/messages/dm/${data.conversation.id}`); }
    } catch {} finally { setCreating(false); }
  }

  const trapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="New message">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={trapRef} className="relative bg-popover rounded-lg shadow-surface-lg w-full max-w-sm border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">New message</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members..."
              className="w-full h-8 pl-9 pr-3 border border-border rounded-md text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none" autoFocus />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto pb-2">
          {filteredMembers.map((member) => (
            <button key={member.userId} onClick={() => handleSelect(member.userId)} disabled={creating}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-left disabled:opacity-50">
              <div className="relative shrink-0">
                <div className="size-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
                  {member.fullName?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                </div>
                {isOnline(member.userId) && (
                  <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success border-2 border-popover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{member.fullName || member.email}</div>
                <div className="text-xs text-muted-foreground truncate">{member.email}</div>
              </div>
            </button>
          ))}
          {filteredMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No members found</p>}
        </div>
      </div>
    </div>
  );
}
