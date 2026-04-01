"use client";

import { Circle, Star, CheckSquare, ArrowUp } from "lucide-react";
import type { Task } from "@/lib/projects/types";

const TYPE_ICONS: Record<string, typeof Circle> = {
  bug: Circle,
  feature: Star,
  task: CheckSquare,
  improvement: ArrowUp,
};

const PRIORITY_COLORS: Record<string, string> = {
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

export function TaskCard({ task, onClick, onDragStart }: TaskCardProps) {
  const TypeIcon = TYPE_ICONS[task.taskType] || CheckSquare;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-foreground/20 transition-all hover:shadow-sm active:opacity-70"
    >
      <div className="flex items-start gap-2">
        <TypeIcon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <span className="text-sm font-medium leading-snug line-clamp-2">{task.title}</span>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.assigneeName && (
          <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center text-[9px] font-bold shrink-0" title={task.assigneeName}>
            {task.assigneeName[0]?.toUpperCase()}
          </div>
        )}

        <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`} title={task.priority} />

        {task.dueDate && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}

        {task.labels.slice(0, 2).map((label, i) => (
          <span
            key={i}
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: label.color + "20", color: label.color }}
          >
            {label.name}
          </span>
        ))}

        <span className="text-[10px] text-muted-foreground/60 ml-auto">{task.displayId}</span>
      </div>
    </div>
  );
}
