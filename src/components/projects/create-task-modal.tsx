"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace/context";
import {
  Circle,
  Star,
  CheckSquare,
  ArrowUp,
  CalendarDays,
  User,
  Tag,
  X,
  Flame,
  SignalHigh,
  SignalMedium,
  SignalLow,
} from "lucide-react";
import type { ProjectColumn, TaskType, Priority, TaskLabel } from "@/lib/projects/types";

const TASK_TYPES: { value: TaskType; label: string; icon: typeof Circle; color: string }[] = [
  { value: "task", label: "Task", icon: CheckSquare, color: "text-blue-400" },
  { value: "bug", label: "Bug", icon: Circle, color: "text-red-400" },
  { value: "feature", label: "Feature", icon: Star, color: "text-amber-400" },
  { value: "improvement", label: "Improvement", icon: ArrowUp, color: "text-emerald-400" },
];

const PRIORITIES: { value: Priority; label: string; icon: typeof Flame; color: string; bg: string }[] = [
  { value: "urgent", label: "Urgent", icon: Flame, color: "text-red-400", bg: "bg-red-500/10" },
  { value: "high", label: "High", icon: SignalHigh, color: "text-orange-400", bg: "bg-orange-500/10" },
  { value: "medium", label: "Medium", icon: SignalMedium, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { value: "low", label: "Low", icon: SignalLow, color: "text-blue-400", bg: "bg-blue-500/10" },
];

const PRESET_LABELS: { name: string; color: string }[] = [
  { name: "Frontend", color: "#3b82f6" },
  { name: "Backend", color: "#8b5cf6" },
  { name: "Design", color: "#ec4899" },
  { name: "DevOps", color: "#f97316" },
  { name: "Testing", color: "#22c55e" },
  { name: "Docs", color: "#06b6d4" },
];

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  columns: ProjectColumn[];
  defaultColumnId: string;
  onCreateTask: (data: {
    columnId: string;
    title: string;
    description?: string;
    taskType?: TaskType;
    priority?: Priority;
    assigneeId?: string;
    dueDate?: string;
    labels?: TaskLabel[];
  }) => Promise<void>;
}

export function CreateTaskModal({
  open,
  onClose,
  columns,
  defaultColumnId,
  onCreateTask,
}: CreateTaskModalProps) {
  const { members } = useWorkspace();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("task");
  const [priority, setPriority] = useState<Priority>("medium");
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset when column changes
  function resetForm() {
    setTitle("");
    setDescription("");
    setTaskType("task");
    setPriority("medium");
    setAssigneeId("");
    setDueDate("");
    setLabels([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
      resetForm();
    }
  }

  function toggleLabel(preset: { name: string; color: string }) {
    setLabels((prev) => {
      const exists = prev.find((l) => l.name === preset.name);
      if (exists) return prev.filter((l) => l.name !== preset.name);
      return [...prev, preset];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await onCreateTask({
        columnId,
        title: title.trim(),
        description: description.trim() || undefined,
        taskType,
        priority,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        labels: labels.length > 0 ? labels : undefined,
      });
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType = TASK_TYPES.find((t) => t.value === taskType)!;
  const selectedPriority = PRIORITIES.find((p) => p.value === priority)!;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            autoFocus
            className="w-full text-base font-medium bg-transparent placeholder:text-muted-foreground/50 focus:outline-none border-b border-border pb-2"
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={3}
            className="w-full text-sm bg-transparent placeholder:text-muted-foreground/40 focus:outline-none resize-none border border-border rounded-lg px-3 py-2"
          />

          {/* Properties grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status / Column */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            {/* Task Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
              <div className="flex gap-1">
                {TASK_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isActive = taskType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTaskType(t.value)}
                      title={t.label}
                      className={`flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all ${
                        isActive
                          ? `${t.color} bg-foreground/5 ring-1 ring-foreground/15`
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
              <div className="flex gap-1">
                {PRIORITIES.map((p) => {
                  const Icon = p.icon;
                  const isActive = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      title={p.label}
                      className={`flex-1 h-9 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? `${p.color} ${p.bg} ring-1 ring-foreground/15`
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assignee</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName || m.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Due date</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Labels
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_LABELS.map((preset) => {
                const isActive = labels.some((l) => l.name === preset.name);
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => toggleLabel(preset)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? "ring-1 ring-foreground/20"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      background: preset.color + (isActive ? "30" : "15"),
                      color: preset.color,
                    }}
                  >
                    {preset.name}
                    {isActive && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => { onClose(); resetForm(); }}
              className="h-9 px-4 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="h-9 px-5 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creating..." : "Create task"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
