"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ProjectColumn } from "@/lib/projects/types";

const COLOR_DOT: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  gray: "bg-gray-400",
};

interface ColumnHeaderProps {
  column: ProjectColumn;
  taskCount: number;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function ColumnHeader({ column, taskCount, onRename, onDelete }: ColumnHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);

  function handleSave() {
    if (editName.trim() && editName !== column.name) {
      onRename(editName.trim());
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between px-1 pb-3">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[column.color] || "bg-gray-400"}`} />
        {editing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="text-sm font-semibold bg-transparent border-b border-border focus:outline-none w-24"
            autoFocus
          />
        ) : (
          <span className="text-sm font-semibold">{column.name}</span>
        )}
        <span className="text-xs text-muted-foreground">{taskCount}</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover/col:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-7 z-50 w-36 bg-popover border border-border rounded-lg shadow-lg py-1">
              <button
                onClick={() => { setMenuOpen(false); setEditing(true); setEditName(column.name); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Rename
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
