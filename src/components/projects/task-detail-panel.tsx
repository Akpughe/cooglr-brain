"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Circle, Star, CheckSquare, ArrowUp } from "lucide-react";
import { useWorkspace } from "@/lib/workspace/context";
import type { Task, ProjectColumn, TaskType, Priority } from "@/lib/projects/types";

const TASK_TYPES: { value: TaskType; label: string; icon: typeof Circle }[] = [
  { value: "task", label: "Task", icon: CheckSquare },
  { value: "bug", label: "Bug", icon: Circle },
  { value: "feature", label: "Feature", icon: Star },
  { value: "improvement", label: "Improvement", icon: ArrowUp },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "low", label: "Low", color: "bg-blue-400" },
];

interface TaskDetailPanelProps {
  task: Task;
  columns: ProjectColumn[];
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function TaskDetailPanel({ task, columns, onClose, onUpdate }: TaskDetailPanelProps) {
  const { members } = useWorkspace();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
  }, [task.id, task.title, task.description]);

  const debouncedUpdate = useCallback(
    (field: string, value: unknown) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(task.id, { [field]: value } as any);
      }, 500);
    },
    [task.id, onUpdate]
  );

  function handleImmediateUpdate(field: string, value: unknown) {
    onUpdate(task.id, { [field]: value } as any);
  }

  return (
    <div className="w-[400px] min-w-[400px] h-full border-l border-border bg-background overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{task.displayId}</span>
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded capitalize">{task.taskType}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            debouncedUpdate("title", e.target.value);
          }}
          className="w-full text-lg font-semibold bg-transparent focus:outline-none border-b border-transparent focus:border-border pb-1"
        />

        {/* Properties */}
        <div className="grid grid-cols-[100px_1fr] gap-y-3 gap-x-2 text-sm">
          {/* Status */}
          <span className="text-muted-foreground">Status</span>
          <select
            value={task.columnId || ""}
            onChange={(e) => handleImmediateUpdate("columnId", e.target.value)}
            className="h-8 px-2 border border-border rounded-md text-sm bg-background"
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>

          {/* Priority */}
          <span className="text-muted-foreground">Priority</span>
          <select
            value={task.priority}
            onChange={(e) => handleImmediateUpdate("priority", e.target.value)}
            className="h-8 px-2 border border-border rounded-md text-sm bg-background"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Assignee */}
          <span className="text-muted-foreground">Assignee</span>
          <select
            value={task.assigneeId || ""}
            onChange={(e) => handleImmediateUpdate("assigneeId", e.target.value || null)}
            className="h-8 px-2 border border-border rounded-md text-sm bg-background"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.fullName || m.email}</option>
            ))}
          </select>

          {/* Type */}
          <span className="text-muted-foreground">Type</span>
          <select
            value={task.taskType}
            onChange={(e) => handleImmediateUpdate("taskType", e.target.value)}
            className="h-8 px-2 border border-border rounded-md text-sm bg-background"
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Due date */}
          <span className="text-muted-foreground">Due date</span>
          <input
            type="date"
            value={task.dueDate || ""}
            onChange={(e) => handleImmediateUpdate("dueDate", e.target.value || null)}
            className="h-8 px-2 border border-border rounded-md text-sm bg-background"
          />

          {/* GitHub repo */}
          <span className="text-muted-foreground">GitHub</span>
          <input
            type="text"
            value={task.githubRepo || ""}
            onChange={(e) => {
              debouncedUpdate("githubRepo", e.target.value || null);
            }}
            placeholder="owner/repo"
            className="h-8 px-2 border border-border rounded-md text-sm bg-background"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium mb-1 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              debouncedUpdate("description", e.target.value);
            }}
            placeholder="Add a description..."
            className="w-full h-32 px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Activity placeholder */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">Activity & comments coming soon</p>
        </div>
      </div>
    </div>
  );
}
