"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { AttachmentPreview } from "./attachment-preview";
import { usePresenceContext } from "@/lib/messages/presence-context";
import type { Message } from "@/lib/messages/types";

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export function MessageItem({ message, isOwn, onEdit, onDelete }: MessageItemProps) {
  const { isOnline } = usePresenceContext();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  function handleSaveEdit() {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent);
    }
    setEditing(false);
  }

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="group flex gap-3 px-4 py-1.5 hover:bg-muted/50 transition-colors">
      <div className="relative shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            message.senderName[0]?.toUpperCase() || "?"
          )}
        </div>
        {isOnline(message.senderId) && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{message.senderName}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
          {message.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full p-2 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2 mt-1">
              <button onClick={handleSaveEdit} className="text-xs text-primary hover:underline">Save</button>
              <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <MarkdownRenderer content={message.content} />
            {message.attachments.map((att, i) => (
              <AttachmentPreview key={i} attachment={att} />
            ))}
          </>
        )}
      </div>

      {isOwn && !editing && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1 shrink-0 mt-1">
          <button
            onClick={() => { setEditContent(message.content); setEditing(true); }}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(message.id)}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
