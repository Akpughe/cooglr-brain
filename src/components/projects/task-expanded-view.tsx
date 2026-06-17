"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Minimize2,
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
  ChevronLeft,
  MessageSquare,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace/context";
import {
  TASK_TYPES,
  PRIORITIES,
  getColumnIcon,
  PropertyRow,
  InlineSelect,
  PriorityBars,
} from "./task-detail-panel";
import type { Task, ProjectColumn, TaskType, Priority } from "@/lib/projects/types";

interface TaskExpandedViewProps {
  task: Task;
  columns: ProjectColumn[];
  projectName: string;
  onClose: () => void;
  onCollapse: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function TaskExpandedView({
  task,
  columns,
  projectName,
  onClose,
  onCollapse,
  onUpdate,
}: TaskExpandedViewProps) {
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
  const colIcon = currentCol ? getColumnIcon(currentCol.name) : null;
  const ColIcon = colIcon?.icon || Circle;
  const priorityConf = PRIORITIES.find((p) => p.value === task.priority);
  const TypeIcon = taskTypeConf.icon;

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Top navigation bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={onClose}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4" />
            <span>{projectName}</span>
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium">{task.displayId}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onCollapse}
            title="Collapse to sidebar"
            aria-label="Collapse to sidebar"
            className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Minimize2 className="size-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close task"
            className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8">
            {/* Type icon */}
            <div className="mb-4">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${taskTypeConf.color} bg-muted`}>
                <TypeIcon className="size-3.5" />
                {taskTypeConf.label}
              </span>
            </div>

            {/* Title */}
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                debouncedUpdate("title", e.target.value);
              }}
              className="w-full text-2xl font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground/40 mb-2"
              placeholder="Task title"
            />

            {/* Inline property chips */}
            <div className="flex items-center gap-2 flex-wrap mb-8 text-sm text-muted-foreground">
              {/* Status chip */}
              {currentCol && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs">
                  <ColIcon className={`size-3.5 ${colIcon?.color || ""}`} />
                  {currentCol.name}
                </span>
              )}

              {/* Priority chip */}
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs ${priorityConf?.color || ""}`}>
                <PriorityBars priority={task.priority} />
                {priorityConf?.label || task.priority}
              </span>

              {/* Assignee chip */}
              {task.assigneeName && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs">
                  <span className="size-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-semibold text-foreground/60">
                    {task.assigneeName[0]?.toUpperCase()}
                  </span>
                  {task.assigneeName}
                </span>
              )}

              {/* Due date chip */}
              {task.dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs">
                  <CalendarDays className="size-3" />
                  {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}

              {/* Labels */}
              {task.labels.map((label, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-md font-medium"
                  style={{ background: label.color + "18", color: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-sm font-medium mb-3">Description</h3>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  debouncedUpdate("description", e.target.value);
                }}
                placeholder="Add a description..."
                className="w-full min-h-[200px] px-4 py-3 border border-border rounded-lg text-sm bg-transparent resize-y focus-visible:ring-2 focus-visible:ring-ring/50 outline-none placeholder:text-muted-foreground/40 leading-relaxed"
              />
            </div>

            {/* Activity section */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  Activity
                </h3>
              </div>

              {/* Created info */}
              <div className="flex items-start gap-3 mb-4">
                <div className="size-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                  <Circle className="size-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm">Task created</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(task.createdAt).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/50 ml-9">Comments coming soon</p>
            </div>
          </div>
        </div>

        {/* Right: properties sidebar */}
        <div className="w-[280px] min-w-[280px] border-l border-border overflow-y-auto">
          <div className="p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Properties</p>

            <div className="space-y-1">
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

            {/* Labels section */}
            {task.labels.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Labels</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.labels.map((label, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: label.color + "20", color: label.color }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
