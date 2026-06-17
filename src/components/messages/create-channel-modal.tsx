"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { Channel } from "@/lib/messages/types";

interface CreateChannelModalProps {
  workspaceId: string;
  onClose: () => void;
  onCreate: (channel: Channel) => void;
}

export function CreateChannelModal({ workspaceId, onClose, onCreate }: CreateChannelModalProps) {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/messages/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create channel"); return; }
      onCreate(data.channel);
      router.push(`/${workspace.slug}/messages/c/${data.channel.id}`);
    } catch { setError("Failed to create channel"); }
    finally { setCreating(false); }
  }

  const slugified = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "");

  const trapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Create channel">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={trapRef} className="relative bg-popover rounded-lg shadow-surface-lg w-full max-w-md border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create channel</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Channel name</label>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">#</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. design"
                className="w-full h-8 pl-7 pr-3 border border-border rounded-md text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none" autoFocus />
            </div>
            {slugified && slugified !== name && <p className="text-xs text-muted-foreground mt-1">Will be created as #{slugified}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this channel about?"
              className="w-full mt-1 h-20 px-3 py-2 border border-border rounded-md text-sm bg-background resize-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button onClick={handleCreate} disabled={!name.trim() || creating}
            className="w-full h-9 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            {creating ? "Creating..." : "Create Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
