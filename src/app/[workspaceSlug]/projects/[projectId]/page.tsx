"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { BoardView } from "@/components/projects/board-view";
import { ListView } from "@/components/projects/list-view";
import { TaskDetailPanel } from "@/components/projects/task-detail-panel";
import { TaskExpandedView } from "@/components/projects/task-expanded-view";
import { FilterBar } from "@/components/projects/filter-bar";
import { AiChatPanel } from "@/components/projects/ai-chat-panel";
import { Plus, Filter, Sparkles, LayoutGrid, List } from "lucide-react";
import type { Project, ProjectColumn, Task, TaskType, Priority, TaskLabel } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type ViewMode = "board" | "list";

interface Filters {
  assignee: string | null;
  priority: string | null;
  taskType: string | null;
  activeOnly: boolean;
}

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { workspace, members } = useWorkspace();

  const [project, setProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("board");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [taskExpanded, setTaskExpanded] = useState(false);
  const [filters, setFilters] = useState<Filters>({ assignee: null, priority: null, taskType: null, activeOnly: false });

  // Sync selected task to URL query param
  function selectTask(task: Task | null) {
    setSelectedTask(task);
    if (!task) setTaskExpanded(false);
    const url = new URL(window.location.href);
    if (task) {
      url.searchParams.set("task", task.id);
    } else {
      url.searchParams.delete("task");
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }

  // Load project data
  const loadData = useCallback(async () => {
    const [projRes, colRes, taskRes] = await Promise.all([
      fetch(`/api/projects?workspaceId=${workspace.id}`),
      fetch(`/api/projects/${projectId}/columns`),
      fetch(`/api/projects/${projectId}/tasks`),
    ]);

    const projData = await projRes.json();
    const colData = await colRes.json();
    const taskData = await taskRes.json();

    const proj = (projData.projects || []).find((p: any) => p.id === projectId);
    setProject(proj || null);
    setColumns(colData.columns || []);

    const loadedTasks: Task[] = taskData.tasks || [];
    setTasks(loadedTasks);
    setLoading(false);

    // Open task from URL if present
    const taskIdFromUrl = new URLSearchParams(window.location.search).get("task");
    if (taskIdFromUrl) {
      const match = loadedTasks.find((t) => t.id === taskIdFromUrl);
      if (match) setSelectedTask(match);
    }
  }, [projectId, workspace.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Find "Done" column for active filter
  const doneColumnId = columns.find((c) => c.name.toLowerCase() === "done")?.id || null;

  // Apply filters
  const filteredTasks = tasks.filter((t) => {
    if (filters.assignee && t.assigneeId !== filters.assignee) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.taskType && t.taskType !== filters.taskType) return false;
    if (filters.activeOnly && doneColumnId && t.columnId === doneColumnId) return false;
    return true;
  });

  // Create task
  async function handleCreateTask(taskData: {
    columnId: string;
    title: string;
    description?: string;
    taskType?: TaskType;
    priority?: Priority;
    assigneeId?: string;
    dueDate?: string;
    labels?: TaskLabel[];
  }) {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...taskData, workspaceId: workspace.id }),
    });
    const data = await res.json();
    if (data.task) {
      // Resolve assignee name from members if available
      if (taskData.assigneeId) {
        const member = members.find((m) => m.userId === taskData.assigneeId);
        if (member) {
          data.task.assigneeName = member.fullName || member.email;
        }
      }
      setTasks((prev) => [...prev, data.task]);
    }
  }

  // Update column
  async function handleUpdateColumn(colId: string, updates: Partial<ProjectColumn>) {
    await fetch(`/api/projects/${projectId}/columns/${colId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setColumns((prev) => prev.map((c) => c.id === colId ? { ...c, ...updates } : c));
  }

  // Delete column
  async function handleDeleteColumn(colId: string) {
    await fetch(`/api/projects/${projectId}/columns/${colId}`, { method: "DELETE" });
    // Move tasks to first remaining column
    const firstCol = columns.find((c) => c.id !== colId);
    if (firstCol) {
      setTasks((prev) => prev.map((t) => t.columnId === colId ? { ...t, columnId: firstCol.id } : t));
    }
    setColumns((prev) => prev.filter((c) => c.id !== colId));
  }

  // Add column
  async function handleAddColumn() {
    const name = prompt("Column name:");
    if (!name) return;
    const res = await fetch(`/api/projects/${projectId}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: "gray" }),
    });
    const data = await res.json();
    if (data.column) setColumns((prev) => [...prev, data.column]);
  }

  // Reorder tasks (drag-and-drop)
  async function handleReorderTasks(updates: { id: string; columnId: string; position: number }[]) {
    // Optimistic update
    setTasks((prev) => {
      const map = new Map(updates.map((u) => [u.id, u]));
      return prev.map((t) => {
        const update = map.get(t.id);
        return update ? { ...t, columnId: update.columnId, position: update.position } : t;
      });
    });

    await fetch("/api/projects/tasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: updates }),
    });
  }

  // Update task from detail panel
  async function handleUpdateTask(taskId: string, updates: Partial<Task>) {
    // Map camelCase to what the API expects
    const apiUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) apiUpdates.title = updates.title;
    if (updates.description !== undefined) apiUpdates.description = updates.description;
    if (updates.taskType !== undefined) apiUpdates.taskType = updates.taskType;
    if (updates.priority !== undefined) apiUpdates.priority = updates.priority;
    if (updates.assigneeId !== undefined) apiUpdates.assigneeId = updates.assigneeId;
    if (updates.columnId !== undefined) apiUpdates.columnId = updates.columnId;
    if (updates.dueDate !== undefined) apiUpdates.dueDate = updates.dueDate;
    if (updates.githubRepo !== undefined) apiUpdates.githubRepo = updates.githubRepo;
    if (updates.labels !== undefined) apiUpdates.labels = updates.labels;

    await fetch(`/api/projects/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiUpdates),
    });

    // Update local state
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => prev ? { ...prev, ...updates } : prev);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  // Expanded task view takes over the entire content area
  if (selectedTask && taskExpanded) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <TaskExpandedView
          task={selectedTask}
          columns={columns}
          projectName={project?.name || "Project"}
          onClose={() => selectTask(null)}
          onCollapse={() => setTaskExpanded(false)}
          onUpdate={handleUpdateTask}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{project?.name || "Project"}</span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-7 px-2 rounded-md text-xs flex items-center gap-1 transition-colors",
              showFilters ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("board")}
              className={cn(
                "h-7 px-2.5 text-xs flex items-center gap-1 transition-colors",
                view === "board" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-7 px-2.5 text-xs flex items-center gap-1 transition-colors",
                view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>

          {view === "board" && (
            <button
              onClick={handleAddColumn}
              className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:bg-muted flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Column
            </button>
          )}

          <button
            onClick={() => setShowAiChat(!showAiChat)}
            className={cn(
              "h-7 px-2 rounded-md text-xs flex items-center gap-1 transition-colors",
              showAiChat ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <FilterBar filters={filters} onFilterChange={setFilters} doneColumnId={doneColumnId} />
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Board or List */}
        {view === "board" ? (
          <BoardView
            columns={columns}
            tasks={filteredTasks}
            onCreateTask={handleCreateTask}
            onUpdateColumn={handleUpdateColumn}
            onDeleteColumn={handleDeleteColumn}
            onReorderTasks={handleReorderTasks}
            onSelectTask={selectTask}
          />
        ) : (
          <ListView
            columns={columns}
            tasks={filteredTasks}
            onSelectTask={selectTask}
          />
        )}

        {/* Task detail panel (sidebar) */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            columns={columns}
            onClose={() => selectTask(null)}
            onExpand={() => setTaskExpanded(true)}
            onUpdate={handleUpdateTask}
          />
        )}

        {/* AI chat panel */}
        {showAiChat && !selectedTask && (
          <AiChatPanel
            projectName={project?.name || "Project"}
            onClose={() => setShowAiChat(false)}
          />
        )}
      </div>
    </div>
  );
}
