"use client";

import {
  Circle,
  Star,
  CheckSquare,
  ArrowUp,
  CalendarDays,
} from "lucide-react";
import type { Task } from "@/lib/projects/types";

const TYPE_ICONS: Record<string, { icon: typeof Circle; color: string }> = {
  bug: { icon: Circle, color: "text-red-400" },
  feature: { icon: Star, color: "text-amber-400" },
  task: { icon: CheckSquare, color: "text-muted-foreground" },
  improvement: { icon: ArrowUp, color: "text-emerald-400" },
};

const PRIORITY_DOTS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export function TaskCard({ task, onClick, onDragStart }: TaskCardProps) {
  const typeConf = TYPE_ICONS[task.taskType] || TYPE_ICONS.task;
  const TypeIcon = typeConf.icon;
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-card border border-border/50 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-card/80 hover:border-border transition-all active:opacity-70 group/card"
    >
      {/* Row 1: ID + assignee */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground font-mono">{task.displayId}</span>
        {task.assigneeName ? (
          <div
            className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center text-[9px] font-semibold text-foreground/60 shrink-0"
            title={task.assigneeName}
          >
            {task.assigneeName[0]?.toUpperCase()}
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/20 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Row 2: Type icon + Title */}
      <div className="flex items-start gap-1.5 mb-2">
        <TypeIcon className={`w-4 h-4 shrink-0 mt-0.5 ${typeConf.color}`} />
        <p className="text-[13px] font-medium leading-snug line-clamp-2">{task.title}</p>
      </div>

      {/* Row 3: Labels (if any) */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 2).map((label, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-px rounded font-medium"
              style={{ background: label.color + "18", color: label.color }}
            >
              {label.name}
            </span>
          ))}
          {task.labels.length > 2 && (
            <span className="text-[10px] text-muted-foreground/50">+{task.labels.length - 2}</span>
          )}
        </div>
      )}

      {/* Row 4: Priority + due date */}
      <div className="flex items-center gap-2">
        {/* Priority dots (Linear-style: 3 small bars) */}
        <div className="flex items-center gap-px" title={task.priority}>
          {task.priority === "urgent" && (
            <div className="flex items-center gap-[2px]">
              <div className="w-[3px] h-2 rounded-sm bg-red-500" />
              <div className="w-[3px] h-2.5 rounded-sm bg-red-500" />
              <div className="w-[3px] h-3 rounded-sm bg-red-500" />
            </div>
          )}
          {task.priority === "high" && (
            <div className="flex items-center gap-[2px]">
              <div className="w-[3px] h-2 rounded-sm bg-orange-500" />
              <div className="w-[3px] h-2.5 rounded-sm bg-orange-500" />
              <div className="w-[3px] h-3 rounded-sm bg-orange-500/30" />
            </div>
          )}
          {task.priority === "medium" && (
            <div className="flex items-center gap-[2px]">
              <div className="w-[3px] h-2 rounded-sm bg-yellow-500" />
              <div className="w-[3px] h-2.5 rounded-sm bg-yellow-500/30" />
              <div className="w-[3px] h-3 rounded-sm bg-yellow-500/30" />
            </div>
          )}
          {task.priority === "low" && (
            <div className="flex items-center gap-[2px]">
              <div className="w-[3px] h-2 rounded-sm bg-blue-400/50" />
              <div className="w-[3px] h-2.5 rounded-sm bg-blue-400/30" />
              <div className="w-[3px] h-3 rounded-sm bg-blue-400/30" />
            </div>
          )}
        </div>

        {/* Due date */}
        {task.dueDate && (
          <span className={`inline-flex items-center gap-1 text-[11px] ${
            overdue ? "text-red-400" : "text-muted-foreground/60"
          }`}>
            <CalendarDays className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}
