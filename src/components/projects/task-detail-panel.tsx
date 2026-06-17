"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Maximize2,
  Circle,
  CircleDot,
  CheckCircle2,
  Clock,
  Star,
  CheckSquare,
  ArrowUp,
  CalendarDays,
  User,
  Columns3,
  Tag,
  GitBranch,
  ChevronDown,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace/context";
import type { Task, ProjectColumn, TaskType, Priority } from "@/lib/projects/types";

/* ── Config (exported for expanded view) ────────────────────── */

export const TASK_TYPES: { value: TaskType; label: string; icon: typeof Circle; color: string }[] = [
  { value: "task", label: "Task", icon: CheckSquare, color: "text-blue-400" },
  { value: "bug", label: "Bug", icon: Circle, color: "text-red-400" },
  { value: "feature", label: "Feature", icon: Star, color: "text-amber-400" },
  { value: "improvement", label: "Improvement", icon: ArrowUp, color: "text-emerald-400" },
];

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "text-red-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low", label: "Low", color: "text-blue-400" },
];

export function getColumnIcon(name: string) {
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

/* ── Property Row ───────────────────────────────────────────── */

export function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Circle;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center min-h-[32px] group/prop">
      <div className="w-[110px] shrink-0 flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* ── Inline Select ──────────────────────────────────────────── */

export function InlineSelect<T extends string>({
  value,
  options,
  onChange,
  renderValue,
  renderOption,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (val: T) => void;
  renderValue?: (val: T) => React.ReactNode;
  renderOption?: (opt: { value: T; label: string }, active: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md text-sm hover:bg-muted transition-colors w-full text-left"
      >
        {renderValue ? renderValue(value) : <span>{currentLabel}</span>}
        <ChevronDown className="size-3 text-muted-foreground/50 ml-auto shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted"
                }`}
              >
                {renderOption ? renderOption(opt, active) : <span>{opt.label}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Panel ─────────────────────────────────────────────── */

interface TaskDetailPanelProps {
  task: Task;
  columns: ProjectColumn[];
  onClose: () => void;
  onExpand: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function TaskDetailPanel({ task, columns, onClose, onExpand, onUpdate }: TaskDetailPanelProps) {
  const { members } = useWorkspace();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  const taskTypeConf = TASK_TYPES.find((t) => t.value === task.taskType) || TASK_TYPES[0];
  const currentCol = columns.find((c) => c.id === task.columnId);

  return (
    <div className="w-[420px] min-w-[420px] h-full border-l border-border bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{task.displayId}</span>
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${taskTypeConf.color} bg-muted`}>
            {(() => { const Icon = taskTypeConf.icon; return <Icon className="size-3" />; })()}
            {taskTypeConf.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onExpand} title="Expand" aria-label="Expand task" className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Maximize2 className="size-3.5" />
          </button>
          <button onClick={onClose} aria-label="Close task detail" className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              debouncedUpdate("title", e.target.value);
            }}
            className="w-full text-lg font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground/40"
            placeholder="Task title"
          />

          {/* Properties */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Properties</p>

            {/* Status */}
            <PropertyRow icon={Columns3} label="Status">
              <InlineSelect
                value={task.columnId || ""}
                options={columns.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(val) => handleImmediateUpdate("columnId", val)}
                renderValue={(val) => {
                  const col = columns.find((c) => c.id === val);
                  if (!col) return <span className="text-muted-foreground">None</span>;
                  const si = getColumnIcon(col.name);
                  const SIcon = si.icon;
                  return (
                    <span className="flex items-center gap-1.5">
                      <SIcon className={`size-3.5 ${si.color}`} />
                      <span>{col.name}</span>
                    </span>
                  );
                }}
                renderOption={(opt) => {
                  const col = columns.find((c) => c.id === opt.value);
                  const si = getColumnIcon(opt.label);
                  const SIcon = si.icon;
                  return (
                    <span className="flex items-center gap-2">
                      <SIcon className={`size-3.5 ${si.color}`} />
                      {opt.label}
                    </span>
                  );
                }}
              />
            </PropertyRow>

            {/* Priority */}
            <PropertyRow icon={Tag} label="Priority">
              <InlineSelect
                value={task.priority}
                options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
                onChange={(val) => handleImmediateUpdate("priority", val)}
                renderValue={(val) => {
                  const p = PRIORITIES.find((pr) => pr.value === val);
                  return (
                    <span className={`flex items-center gap-1.5 ${p?.color || ""}`}>
                      <PriorityBars priority={val as Priority} />
                      <span>{p?.label || val}</span>
                    </span>
                  );
                }}
                renderOption={(opt) => {
                  const p = PRIORITIES.find((pr) => pr.value === opt.value);
                  return (
                    <span className={`flex items-center gap-2 ${p?.color || ""}`}>
                      <PriorityBars priority={opt.value as Priority} />
                      {opt.label}
                    </span>
                  );
                }}
              />
            </PropertyRow>

            {/* Assignee */}
            <PropertyRow icon={User} label="Assignee">
              <InlineSelect
                value={task.assigneeId || ""}
                options={[
                  { value: "", label: "Unassigned" },
                  ...members.map((m) => ({ value: m.userId, label: m.fullName || m.email })),
                ]}
                onChange={(val) => handleImmediateUpdate("assigneeId", val || null)}
                renderValue={(val) => {
                  if (!val) return <span className="text-muted-foreground">Unassigned</span>;
                  const m = members.find((mb) => mb.userId === val);
                  const name = m?.fullName || m?.email || "Unknown";
                  return (
                    <span className="flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-semibold text-foreground/60 shrink-0">
                        {name[0]?.toUpperCase()}
                      </span>
                      <span>{name}</span>
                    </span>
                  );
                }}
              />
            </PropertyRow>

            {/* Type */}
            <PropertyRow icon={CheckSquare} label="Type">
              <InlineSelect
                value={task.taskType}
                options={TASK_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                onChange={(val) => handleImmediateUpdate("taskType", val)}
                renderValue={(val) => {
                  const t = TASK_TYPES.find((tt) => tt.value === val);
                  if (!t) return <span>{val}</span>;
                  const TIcon = t.icon;
                  return (
                    <span className={`flex items-center gap-1.5 ${t.color}`}>
                      <TIcon className="size-3.5" />
                      <span>{t.label}</span>
                    </span>
                  );
                }}
                renderOption={(opt) => {
                  const t = TASK_TYPES.find((tt) => tt.value === opt.value);
                  if (!t) return <span>{opt.label}</span>;
                  const TIcon = t.icon;
                  return (
                    <span className={`flex items-center gap-2 ${t.color}`}>
                      <TIcon className="size-3.5" />
                      {opt.label}
                    </span>
                  );
                }}
              />
            </PropertyRow>

            {/* Due date */}
            <PropertyRow icon={CalendarDays} label="Due date">
              <input
                type="date"
                value={task.dueDate || ""}
                onChange={(e) => handleImmediateUpdate("dueDate", e.target.value || null)}
                className="px-2 py-1 -ml-2 rounded-md text-sm bg-transparent hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 outline-none focus:bg-muted w-full"
              />
            </PropertyRow>

            {/* GitHub repo */}
            <PropertyRow icon={GitBranch} label="GitHub">
              <input
                type="text"
                value={task.githubRepo || ""}
                onChange={(e) => debouncedUpdate("githubRepo", e.target.value || null)}
                placeholder="owner/repo"
                className="px-2 py-1 -ml-2 rounded-md text-sm bg-transparent hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 outline-none focus:bg-muted placeholder:text-muted-foreground/40 w-full"
              />
            </PropertyRow>
          </div>

          {/* Description */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                debouncedUpdate("description", e.target.value);
              }}
              placeholder="Add a description..."
              className="w-full min-h-[120px] px-3 py-2 border border-border rounded-lg text-sm bg-transparent resize-none focus-visible:ring-2 focus-visible:ring-ring/50 outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Activity placeholder */}
          <div className="pt-4 border-t border-border">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity</p>
            <p className="text-xs text-muted-foreground/60">Activity & comments coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Priority Bars (small visual) ───────────────────────────── */

export function PriorityBars({ priority }: { priority: Priority }) {
  const configs: Record<Priority, { bars: number; color: string }> = {
    urgent: { bars: 3, color: "bg-red-500" },
    high: { bars: 3, color: "bg-orange-500" },
    medium: { bars: 3, color: "bg-yellow-500" },
    low: { bars: 3, color: "bg-blue-400" },
  };
  const { color } = configs[priority];
  const filled = priority === "urgent" ? 3 : priority === "high" ? 2 : priority === "medium" ? 1 : 1;

  return (
    <div className="flex items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-sm ${i < filled ? color : `${color}/25`}`}
          style={{ height: `${6 + i * 2}px` }}
        />
      ))}
    </div>
  );
}
