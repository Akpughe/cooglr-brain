"use client";

import { useState, useRef } from "react";
import { Bold, Italic, Code, Link, Paperclip, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/messages/types";

interface MessageComposerProps {
  placeholder: string;
  workspaceId: string;
  targetId: string;
  onSend: (content: string, attachments: Attachment[]) => void;
  onTyping: () => void;
}

export function MessageComposer({ placeholder, workspaceId, targetId, onSend, onTyping }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleSend() {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setContent("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    onTyping();
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024 || attachments.length >= 5) break;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", workspaceId);
      formData.append("targetId", targetId);
      try {
        const res = await fetch("/api/messages/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.attachment) setAttachments((prev) => [...prev, data.attachment]);
      } catch {}
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function wrapSelection(prefix: string, suffix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(newContent);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + prefix.length); }, 0);
  }

  const hasContent = content.trim().length > 0 || attachments.length > 0;

  return (
    <div className="border-t border-border px-4 py-3">
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg text-xs">
              <span className="truncate max-w-[150px]">{att.name}</span>
              <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-border rounded-xl bg-card">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="w-full px-4 pt-3 pb-1 text-sm bg-transparent resize-none focus:outline-none"
          style={{ minHeight: "36px", maxHeight: "120px" }}
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={Bold} onClick={() => wrapSelection("**", "**")} title="Bold" />
            <ToolbarButton icon={Italic} onClick={() => wrapSelection("*", "*")} title="Italic" />
            <ToolbarButton icon={Code} onClick={() => wrapSelection("`", "`")} title="Code" />
            <ToolbarButton icon={Link} onClick={() => wrapSelection("[", "](url)")} title="Link" />
            <div className="w-px h-4 bg-border mx-1" />
            <ToolbarButton icon={Paperclip} onClick={() => fileInputRef.current?.click()} title="Attach file" loading={uploading} />
          </div>
          <button
            onClick={handleSend}
            disabled={!hasContent}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-all",
              hasContent ? "bg-foreground text-background hover:opacity-90" : "bg-muted text-muted-foreground"
            )}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
    </div>
  );
}

function ToolbarButton({ icon: Icon, onClick, title, loading = false }: { icon: any; onClick: () => void; title: string; loading?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={loading}
      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
      <Icon className="w-4 h-4" />
    </button>
  );
}
