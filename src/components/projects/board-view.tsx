"use client";

import { useState } from "react";
import { ColumnHeader } from "./column-header";
import { TaskCard } from "./task-card";
import { CreateTaskModal } from "./create-task-modal";
import type { ProjectColumn, Task, TaskType, Priority, TaskLabel } from "@/lib/projects/types";

interface BoardViewProps {
  columns: ProjectColumn[];
  tasks: Task[];
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
  onUpdateColumn: (colId: string, updates: Partial<ProjectColumn>) => Promise<void>;
  onDeleteColumn: (colId: string) => Promise<void>;
  onReorderTasks: (updates: { id: string; columnId: string; position: number }[]) => Promise<void>;
  onSelectTask: (task: Task) => void;
}

export function BoardView({
  columns,
  tasks,
  onCreateTask,
  onUpdateColumn,
  onDeleteColumn,
  onReorderTasks,
  onSelectTask,
}: BoardViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [createModalColumnId, setCreateModalColumnId] = useState<string | null>(null);

  function getTasksForColumn(columnId: string): Task[] {
    return tasks
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColId(columnId);
  }

  function handleDragLeave() {
    setDragOverColId(null);
  }

  function handleDrop(e: React.DragEvent, targetColumnId: string) {
    e.preventDefault();
    setDragOverColId(null);
    const taskId = e.dataTransfer.getData("text/plain");
    setDraggedTaskId(null);

    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const targetTasks = getTasksForColumn(targetColumnId).filter((t) => t.id !== taskId);
    const updates = targetTasks.map((t, i) => ({
      id: t.id,
      columnId: targetColumnId,
      position: i,
    }));

    updates.push({
      id: taskId,
      columnId: targetColumnId,
      position: targetTasks.length,
    });

    if (task.columnId !== targetColumnId && task.columnId) {
      const sourceTasks = getTasksForColumn(task.columnId).filter((t) => t.id !== taskId);
      sourceTasks.forEach((t, i) => {
        updates.push({ id: t.id, columnId: task.columnId!, position: i });
      });
    }

    onReorderTasks(updates);
  }

  return (
    <>
      <div className="flex-1 overflow-x-auto bg-muted/20">
        <div className="flex gap-3 p-4 h-full min-w-max">
          {columns.map((col) => {
            const colTasks = getTasksForColumn(col.id);
            return (
              <div
                key={col.id}
                className={`group/col relative w-[300px] shrink-0 flex flex-col rounded-lg transition-colors ${
                  dragOverColId === col.id ? "bg-muted/60" : "bg-muted/30"
                }`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="sticky top-0 pt-1 pb-0 px-1 z-10">
                  <ColumnHeader
                    column={col}
                    taskCount={colTasks.length}
                    onRename={(name) => onUpdateColumn(col.id, { name })}
                    onDelete={() => onDeleteColumn(col.id)}
                    onAddTask={() => setCreateModalColumnId(col.id)}
                  />
                </div>

                <div className="flex-1 px-1.5 pb-2 space-y-1.5 min-h-[80px]">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onSelectTask(task)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CreateTaskModal
        open={createModalColumnId !== null}
        onClose={() => setCreateModalColumnId(null)}
        columns={columns}
        defaultColumnId={createModalColumnId || columns[0]?.id || ""}
        onCreateTask={onCreateTask}
      />
    </>
  );
}
