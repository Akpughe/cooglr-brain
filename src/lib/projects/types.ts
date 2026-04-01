export type TaskType = "bug" | "feature" | "task" | "improvement";
export type Priority = "urgent" | "high" | "medium" | "low";

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  identifier: string;
  taskCounter: number;
  createdBy: string;
  createdAt: string;
  taskCount?: number;
}

export interface ProjectColumn {
  id: string;
  projectId: string;
  name: string;
  color: string;
  position: number;
  createdAt: string;
}

export interface TaskLabel {
  name: string;
  color: string;
}

export interface Task {
  id: string;
  projectId: string;
  workspaceId: string;
  columnId: string | null;
  taskNumber: number;
  displayId: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  labels: TaskLabel[];
  dueDate: string | null;
  githubRepo: string | null;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
