"use client";

import { useState } from "react";
import { Circle, Star, CheckSquare, ArrowUp } from "lucide-react";
import type { Task, ProjectColumn } from "@/lib/projects/types";

const TYPE_ICONS: Record<string, typeof Circle> = {
  bug: Circle,
  feature: Star,
  task: CheckSquare,
  improvement: ArrowUp,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-600",
  low: "text-blue-400",
};

interface ListViewProps {
  columns: ProjectColumn[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

type SortField = "taskNumber" | "title" | "priority" | "assigneeName" | "dueDate" | "taskType";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function ListView({ columns, tasks, onSelectTask }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>("taskNumber");
  const [sortAsc, setSortAsc] = useState(true);

  const columnsMap = new Map(columns.map((c) => [c.id, c]));

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "taskNumber": cmp = a.taskNumber - b.taskNumber; break;
      case "title": cmp = a.title.localeCompare(b.title); break;
      case "priority": cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2); break;
      case "assigneeName": cmp = (a.assigneeName || "zzz").localeCompare(b.assigneeName || "zzz"); break;
      case "dueDate": cmp = (a.dueDate || "9999").localeCompare(b.dueDate || "9999"); break;
      case "taskType": cmp = a.taskType.localeCompare(b.taskType); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  function SortHeader({ field, label, className }: { field: SortField; label: string; className?: string }) {
    return (
      <th
        className={`text-left text-xs font-medium text-muted-foreground py-2 px-3 cursor-pointer hover:text-foreground select-none ${className || ""}`}
        onClick={() => handleSort(field)}
      >
        {label} {sortField === field ? (sortAsc ? "↑" : "↓") : ""}
      </th>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No tasks yet. Create one from the board view.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <SortHeader field="taskNumber" label="ID" className="w-20" />
            <SortHeader field="title" label="Title" />
            <th className="text-left text-xs font-medium text-muted-foreground py-2 px-3 w-28">Status</th>
            <SortHeader field="priority" label="Priority" className="w-24" />
            <SortHeader field="assigneeName" label="Assignee" className="w-32" />
            <SortHeader field="taskType" label="Type" className="w-24" />
            <SortHeader field="dueDate" label="Due" className="w-28" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const TypeIcon = TYPE_ICONS[task.taskType] || CheckSquare;
            const col = task.columnId ? columnsMap.get(task.columnId) : null;
            return (
              <tr
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <td className="py-2.5 px-3 text-xs text-muted-foreground">{task.displayId}</td>
                <td className="py-2.5 px-3 text-sm font-medium">{task.title}</td>
                <td className="py-2.5 px-3">
                  {col && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                      {col.name}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`text-xs font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  {task.assigneeName ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center text-[9px] font-bold">
                        {task.assigneeName[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs truncate">{task.assigneeName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <TypeIcon className="w-4 h-4 text-muted-foreground" />
                </td>
                <td className="py-2.5 px-3 text-xs text-muted-foreground">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
