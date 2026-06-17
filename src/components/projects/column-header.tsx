"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Plus, Circle, CircleDot, CheckCircle2, XCircle, Clock, Archive } from "lucide-react";
import type { ProjectColumn } from "@/lib/projects/types";

/**
 * Maps column name to a semantic status icon + color.
 * Falls back to a generic circle if the name doesn't match.
 */
function getStatusIcon(name: string, color: string) {
  const lower = name.toLowerCase().trim();

  if (lower === "to do" || lower === "todo" || lower === "backlog")
    return { icon: Circle, color: "text-muted-foreground" };
  if (lower === "in progress" || lower === "in-progress" || lower === "doing" || lower === "active")
    return { icon: CircleDot, color: "text-amber-500" };
  if (lower === "done" || lower === "completed" || lower === "complete")
    return { icon: CheckCircle2, color: "text-emerald-500" };
  if (lower === "cancelled" || lower === "canceled" || lower === "archived")
    return { icon: XCircle, color: "text-muted-foreground" };
  if (lower === "review" || lower === "in review" || lower === "pending")
    return { icon: Clock, color: "text-blue-400" };

  // Fallback to colored circle
  const colorMap: Record<string, string> = {
    red: "text-red-500", blue: "text-blue-500", green: "text-emerald-500",
    yellow: "text-amber-500", purple: "text-purple-500", orange: "text-orange-500",
    gray: "text-muted-foreground",
  };
  return { icon: Circle, color: colorMap[color] || "text-muted-foreground" };
}

interface ColumnHeaderProps {
  column: ProjectColumn;
  taskCount: number;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddTask: () => void;
}

export function ColumnHeader({ column, taskCount, onRename, onDelete, onAddTask }: ColumnHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);

  const status = getStatusIcon(column.name, column.color);
  const StatusIcon = status.icon;

  function handleSave() {
    if (editName.trim() && editName !== column.name) {
      onRename(editName.trim());
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between px-2 pb-3">
      <div className="flex items-center gap-2 min-w-0">
        <StatusIcon className={`size-4 shrink-0 ${status.color}`} />
        {editing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="text-sm font-medium bg-transparent border-b border-border focus:outline-none w-24"
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium truncate">{column.name}</span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{taskCount}</span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Column options"
          className="size-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        <button
          onClick={onAddTask}
          aria-label="Add task"
          className="size-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
          title="Add task"
        >
          <Plus className="size-3.5" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-2 top-8 z-50 w-36 bg-popover border border-border rounded-lg shadow-lg py-1">
              <button
                onClick={() => { setMenuOpen(false); setEditing(true); setEditName(column.name); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Pencil className="size-3.5" /> Rename
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
