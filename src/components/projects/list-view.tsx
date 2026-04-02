"use client";

import { useState } from "react";
import {
  Circle,
  CircleDot,
  CheckCircle2,
  Clock,
  Star,
  CheckSquare,
  ArrowUp,
  CalendarDays,
  ArrowDownAZ,
  ArrowUpAZ,
} from "lucide-react";
import type { Task, ProjectColumn } from "@/lib/projects/types";

const TYPE_ICONS: Record<string, { icon: typeof Circle; color: string }> = {
  bug: { icon: Circle, color: "text-red-400" },
  feature: { icon: Star, color: "text-amber-400" },
  task: { icon: CheckSquare, color: "text-muted-foreground" },
  improvement: { icon: ArrowUp, color: "text-emerald-400" },
};

function getColumnStatusIcon(name: string) {
  const lower = name.toLowerCase().trim();
  if (lower === "to do" || lower === "todo" || lower === "backlog")
    return { icon: Circle, color: "text-muted-foreground" };
  if (lower === "in progress" || lower === "in-progress" || lower === "doing")
    return { icon: CircleDot, color: "text-amber-500" };
  if (lower === "done" || lower === "completed")
    return { icon: CheckCircle2, color: "text-emerald-500" };
  if (lower === "review" || lower === "in review" || lower === "pending")
    return { icon: Clock, color: "text-blue-400" };
  return { icon: Circle, color: "text-muted-foreground" };
}

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
    const active = sortField === field;
    return (
      <th
        className={`text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-2 px-3 cursor-pointer select-none hover:text-foreground transition-colors ${className || ""}`}
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortAsc ? <ArrowDownAZ className="w-3 h-3" /> : <ArrowUpAZ className="w-3 h-3" />)}
        </span>
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
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b border-border">
            <SortHeader field="taskNumber" label="ID" className="w-20 pl-4" />
            <SortHeader field="priority" label="Priority" className="w-20" />
            <SortHeader field="title" label="Title" />
            <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-2 px-3 w-28">Status</th>
            <SortHeader field="assigneeName" label="Assignee" className="w-32" />
            <SortHeader field="dueDate" label="Due" className="w-28 pr-4" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const typeConf = TYPE_ICONS[task.taskType] || TYPE_ICONS.task;
            const TypeIcon = typeConf.icon;
            const col = task.columnId ? columnsMap.get(task.columnId) : null;
            const statusConf = col ? getColumnStatusIcon(col.name) : null;
            const StatusIcon = statusConf?.icon || Circle;
            const overdue = task.dueDate ? new Date(task.dueDate) < new Date(new Date().toDateString()) : false;

            return (
              <tr
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="border-b border-border/40 hover:bg-muted/40 cursor-pointer transition-colors group"
              >
                {/* ID */}
                <td className="py-2.5 px-3 pl-4">
                  <span className="text-[11px] text-muted-foreground font-mono">{task.displayId}</span>
                </td>

                {/* Priority bars */}
                <td className="py-2.5 px-3">
                  <div className="flex items-end gap-[2px]" title={task.priority}>
                    {[0, 1, 2].map((i) => {
                      const filled = task.priority === "urgent" ? 3 : task.priority === "high" ? 2 : task.priority === "medium" ? 1 : 1;
                      const colorMap: Record<string, string> = { urgent: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-blue-400" };
                      const color = colorMap[task.priority] || "bg-muted-foreground";
                      return (
                        <div
                          key={i}
                          className={`w-[3px] rounded-sm ${i < filled ? color : `${color}/25`}`}
                          style={{ height: `${6 + i * 2}px` }}
                        />
                      );
                    })}
                  </div>
                </td>

                {/* Title with type icon */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <TypeIcon className={`w-4 h-4 shrink-0 ${typeConf.color}`} />
                    <span className="text-sm">{task.title}</span>
                  </div>
                </td>

                {/* Status with icon */}
                <td className="py-2.5 px-3">
                  {col && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusIcon className={`w-3.5 h-3.5 ${statusConf?.color || ""}`} />
                      {col.name}
                    </span>
                  )}
                </td>

                {/* Assignee */}
                <td className="py-2.5 px-3">
                  {task.assigneeName ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center text-[9px] font-semibold text-foreground/60">
                        {task.assigneeName[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs truncate">{task.assigneeName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">No assignee</span>
                  )}
                </td>

                {/* Due date */}
                <td className="py-2.5 px-3 pr-4">
                  {task.dueDate ? (
                    <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
                      <CalendarDays className="w-3 h-3" />
                      {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/30">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
