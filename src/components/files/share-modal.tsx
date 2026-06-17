"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace/context";
import { X, UserPlus, Trash2 } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { FileShare } from "@/lib/files/types";

interface Props {
  fileId: string;
  onClose: () => void;
}

export function ShareModal({ fileId, onClose }: Props) {
  const { members, currentUserId } = useWorkspace();
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [shares, setShares] = useState<FileShare[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");

  useEffect(() => {
    fetch(`/api/files/${fileId}/share`)
      .then((r) => r.json())
      .then((data) => setShares(data.shares || []));
  }, [fileId]);

  async function handleShare() {
    if (!selectedUserId) return;
    const res = await fetch(`/api/files/${fileId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, permission }),
    });
    const data = await res.json();
    if (data.share) {
      setShares((prev) => [...prev.filter((s) => s.sharedWith !== selectedUserId), data.share]);
      setSelectedUserId("");
    }
  }

  async function handleRevoke(userId: string) {
    await fetch(`/api/files/${fileId}/share/${userId}`, { method: "DELETE" });
    setShares((prev) => prev.filter((s) => s.sharedWith !== userId));
  }

  const sharedUserIds = new Set(shares.map((s) => s.sharedWith));
  const availableMembers = members.filter(
    (m) => m.userId !== currentUserId && !sharedUserIds.has(m.userId)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Share file">
      <div ref={trapRef} className="bg-[#1a1a2e] border border-foreground/10 rounded-xl w-[420px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.06]">
          <h2 className="text-base font-semibold">Share file</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        {/* Add share */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 bg-foreground/5 border border-foreground/10 rounded-md px-3 py-2 text-sm outline-none"
            >
              <option value="">Select a member...</option>
              {availableMembers.map((m) => (
                <option key={m.userId} value={m.userId}>{m.fullName}</option>
              ))}
            </select>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as "view" | "edit")}
              className="bg-foreground/5 border border-foreground/10 rounded-md px-2 py-2 text-sm outline-none"
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
            </select>
            <button
              onClick={handleShare}
              disabled={!selectedUserId}
              className="px-3 py-2 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
            >
              <UserPlus className="size-4" />
            </button>
          </div>

          {/* Current shares */}
          {shares.length > 0 && (
            <div className="space-y-1 mt-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/50 mb-2">Shared with</p>
              {shares.map((share) => {
                const member = members.find((m) => m.userId === share.sharedWith);
                return (
                  <div key={share.id} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-foreground/5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs">
                        {member?.fullName?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm">{member?.fullName || "Unknown"}</p>
                        <p className="text-[11px] text-muted-foreground/50">{share.permission}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(share.sharedWith)}
                      className="text-red-400/50 hover:text-red-400 p-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {shares.length === 0 && (
            <p className="text-sm text-muted-foreground/50 text-center py-4">
              Not shared with anyone yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
