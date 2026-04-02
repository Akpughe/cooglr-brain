export type FileNodeType = "page" | "folder" | "file";

export interface FileNode {
  id: string;
  workspaceId: string;
  parentId: string | null;
  type: FileNodeType;
  title: string;
  content: Record<string, unknown> | null;
  icon: string | null;
  coverUrl: string | null;
  storagePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  isPrivate: boolean;
  position: number;
  createdBy: string;
  updatedAt: string;
  createdAt: string;
}

export interface FileShare {
  id: string;
  fileId: string;
  sharedWith: string;
  permission: "view" | "edit";
  createdAt: string;
}

/** Lightweight node for sidebar tree (no content field) */
export interface FileTreeNode {
  id: string;
  parentId: string | null;
  type: FileNodeType;
  title: string;
  icon: string | null;
  isPrivate: boolean;
  position: number;
  createdBy: string;
  updatedAt: string;
}
