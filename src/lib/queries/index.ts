"use client";

// React Query data layer for the agent shell. Centralizes all client data calls
// so surfaces get caching, instant revisits, and easy invalidation.

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { ThreadSummary } from "@/components/agent-shell/types";

// ---- Shared types ----
export interface FileNode {
  id: string;
  parentId: string | null;
  type: "page" | "folder" | "file";
  title: string;
  icon: string | null;
  isPrivate: boolean;
  position: number;
  createdBy: string;
  updatedAt: string;
  indexStatus?: string | null;
}

// ---- Query keys ----
export const qk = {
  files: (workspaceId: string, parentId: string | "root") =>
    ["files", workspaceId, parentId] as const,
  threads: (workspaceId: string) => ["threads", workspaceId] as const,
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ---- Files / folders ----
export function useFiles(workspaceId: string, parentId: string | null) {
  const key = parentId ?? "root";
  return useQuery({
    queryKey: qk.files(workspaceId, key),
    queryFn: () =>
      getJson<{ files: FileNode[] }>(
        `/api/files?workspaceId=${workspaceId}&parentId=${parentId ?? "null"}`,
      ).then((d) => d.files ?? []),
  });
}

/** Top-level folders only (parent = root, type = folder). */
export function useFolders(workspaceId: string) {
  const q = useFiles(workspaceId, null);
  return { ...q, data: q.data?.filter((f) => f.type === "folder") };
}

/** Children of a folder (any type). */
export function useFolderContents(workspaceId: string, folderId: string) {
  return useFiles(workspaceId, folderId);
}

export function useCreateFolder(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, title, type: "folder", parentId: null }),
      }).then((r) => {
        if (!r.ok) throw new Error("create failed");
        return r.json() as Promise<{ file: { id: string; title: string; createdBy: string } }>;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.files(workspaceId, "root") }),
  });
}

export function useDeleteFile(workspaceId: string, parentId: string | null) {
  const qc = useQueryClient();
  const key = parentId ?? "root";
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/files/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("delete failed");
        return id;
      }),
    // Optimistic remove
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.files(workspaceId, key) });
      const prev = qc.getQueryData<FileNode[]>(qk.files(workspaceId, key));
      qc.setQueryData<FileNode[]>(qk.files(workspaceId, key), (old) =>
        (old ?? []).filter((f) => f.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.files(workspaceId, key), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.files(workspaceId, key) }),
  });
}

// ---- Threads ----
export function useThreads(workspaceId: string, initialData?: ThreadSummary[]) {
  return useQuery({
    queryKey: qk.threads(workspaceId),
    queryFn: () =>
      getJson<{ threads: ThreadSummary[] }>(
        `/api/agent/threads?workspaceId=${workspaceId}`,
      ).then((d) => d.threads ?? []),
    initialData,
  });
}

export function invalidateThreads(qc: QueryClient, workspaceId: string) {
  return qc.invalidateQueries({ queryKey: qk.threads(workspaceId) });
}

export function invalidateFiles(qc: QueryClient, workspaceId: string, parentId: string | null) {
  return qc.invalidateQueries({ queryKey: qk.files(workspaceId, parentId ?? "root") });
}
