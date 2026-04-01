"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface CreateTaskInlineProps {
  onCreateTask: (title: string) => void;
}

export function CreateTaskInline({ onCreateTask }: CreateTaskInlineProps) {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState("");

  function handleSubmit() {
    if (title.trim()) {
      onCreateTask(title.trim());
      setTitle("");
    }
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add card
      </button>
    );
  }

  return (
    <div className="p-1">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setActive(false); setTitle(""); }
        }}
        onBlur={() => { if (!title.trim()) setActive(false); }}
        placeholder="Task title..."
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
    </div>
  );
}
