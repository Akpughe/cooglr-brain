"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { X } from "lucide-react";

interface Filters {
  assignee: string | null;
  priority: string | null;
  taskType: string | null;
  activeOnly: boolean;
}

interface FilterBarProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  doneColumnId: string | null;
}

export function FilterBar({ filters, onFilterChange, doneColumnId }: FilterBarProps) {
  const { members } = useWorkspace();

  const hasFilters = filters.assignee || filters.priority || filters.taskType || filters.activeOnly;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
      {/* Quick toggles */}
      <button
        onClick={() => onFilterChange({ ...filters, activeOnly: false })}
        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
          !filters.activeOnly ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        All
      </button>
      <button
        onClick={() => onFilterChange({ ...filters, activeOnly: true })}
        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
          filters.activeOnly ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        Active
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Assignee */}
      <select
        value={filters.assignee || ""}
        onChange={(e) => onFilterChange({ ...filters, assignee: e.target.value || null })}
        className="h-7 px-2 text-xs border border-border rounded-md bg-background"
      >
        <option value="">All members</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>{m.fullName || m.email}</option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={filters.priority || ""}
        onChange={(e) => onFilterChange({ ...filters, priority: e.target.value || null })}
        className="h-7 px-2 text-xs border border-border rounded-md bg-background"
      >
        <option value="">All priorities</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {/* Type */}
      <select
        value={filters.taskType || ""}
        onChange={(e) => onFilterChange({ ...filters, taskType: e.target.value || null })}
        className="h-7 px-2 text-xs border border-border rounded-md bg-background"
      >
        <option value="">All types</option>
        <option value="task">Task</option>
        <option value="bug">Bug</option>
        <option value="feature">Feature</option>
        <option value="improvement">Improvement</option>
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => onFilterChange({ assignee: null, priority: null, taskType: null, activeOnly: false })}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <X className="size-3" /> Clear
        </button>
      )}
    </div>
  );
}
