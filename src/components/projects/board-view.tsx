"use client";

import { useState } from "react";
import { ColumnHeader } from "./column-header";
import { TaskCard } from "./task-card";
import { CreateTaskInline } from "./create-task-inline";
import type { ProjectColumn, Task } from "@/lib/projects/types";

interface BoardViewProps {
  columns: ProjectColumn[];
  tasks: Task[];
  onCreateTask: (columnId: string, title: string) => Promise<void>;
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
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-4 p-4 h-full min-w-max">
        {columns.map((col) => {
          const colTasks = getTasksForColumn(col.id);
          return (
            <div
              key={col.id}
              className={`group/col w-[280px] shrink-0 flex flex-col rounded-xl transition-colors ${
                dragOverColId === col.id ? "bg-muted/50" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <ColumnHeader
                column={col}
                taskCount={colTasks.length}
                onRename={(name) => onUpdateColumn(col.id, { name })}
                onDelete={() => onDeleteColumn(col.id)}
              />

              <div className="flex-1 space-y-2 min-h-[100px]">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onSelectTask(task)}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                  />
                ))}
              </div>

              <div className="mt-2">
                <CreateTaskInline
                  onCreateTask={(title) => onCreateTask(col.id, title)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
