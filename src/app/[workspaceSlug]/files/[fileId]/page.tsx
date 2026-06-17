"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { PageEditor } from "@/components/files/page-editor";
import { FolderView } from "@/components/files/folder-view";
import { FilePreview } from "@/components/files/file-preview";
import { Lock, Globe, Check } from "lucide-react";
import type { FileNode } from "@/lib/files/types";
import { toast } from "sonner";
import { PageLoading } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/error-state";

export default function FileDetailPage() {
  const params = useParams<{ fileId: string }>();
  const { workspace, members } = useWorkspace();
  const [file, setFile] = useState<FileNode | null>(null);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Skip loading for temp (optimistic) IDs — editor will show blank until real ID arrives
  const isTemp = params.fileId.startsWith("temp-");

  const loadFile = useCallback(async () => {
    if (isTemp) {
      // Optimistic page — show empty editor immediately
      setFile({
        id: params.fileId,
        workspaceId: workspace.id,
        parentId: null,
        type: "page",
        title: "Untitled",
        content: null,
        icon: null,
        coverUrl: null,
        storagePath: null,
        mimeType: null,
        fileSize: null,
        isPrivate: false,
        position: 0,
        createdBy: "",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/files/${params.fileId}`);
      const data = await res.json();
      if (data.file) setFile(data.file);
    } catch {
      toast.error("Failed to load file");
    }
    setLoading(false);
  }, [params.fileId, isTemp, workspace.id]);

  const loadChildren = useCallback(async () => {
    if (!file || file.type !== "folder") return;
    const res = await fetch(`/api/files?workspaceId=${workspace.id}`);
    const data = await res.json();
    const allFiles: FileNode[] = data.files || [];
    setChildren(allFiles.filter((f) => f.parentId === params.fileId));
  }, [file, workspace.id, params.fileId]);

  useEffect(() => { loadFile(); }, [loadFile]);
  useEffect(() => { loadChildren(); }, [loadChildren]);

  async function handleUpdate(updates: Partial<FileNode>) {
    if (isTemp) return; // Don't save temp pages

    // Optimistic update
    setFile((prev) => prev ? { ...prev, ...updates } : prev);
    setSaveStatus("saving");

    try {
      const res = await fetch(`/api/files/${params.fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        toast.error("Failed to save");
        setSaveStatus("idle");
        return;
      }

      setSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      toast.error("Failed to save — check your connection");
      setSaveStatus("idle");
    }
  }

  async function handleCreatePage(parentId: string) {
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, type: "page", title: "Untitled", parentId }),
      });
      const data = await res.json();
      if (data.file) {
        loadChildren();
        toast.success("Page created");
      }
    } catch {
      toast.error("Failed to create page");
    }
  }

  function handleUpload(parentId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      toast.loading("Uploading...", { id: "folder-upload" });
      let ok = true;
      for (const f of Array.from(input.files)) {
        const formData = new FormData();
        formData.append("file", f);
        formData.append("workspaceId", workspace.id);
        formData.append("parentId", parentId);
        try {
          const res = await fetch("/api/files/upload", { method: "POST", body: formData });
          if (!res.ok) ok = false;
        } catch { ok = false; }
      }
      loadChildren();
      if (ok) toast.success("Uploaded", { id: "folder-upload" });
      else toast.error("Some uploads failed", { id: "folder-upload" });
    };
    input.click();
  }

  // Cleanup
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  if (loading) {
    return <PageLoading />;
  }

  if (!file) {
    return (
      <ErrorState
        title="File not found"
        description="This file may have been moved or deleted."
      />
    );
  }

  const creatorName = members.find((m) => m.userId === file.createdBy)?.fullName || "You";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Meta bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-2 text-xs text-muted-foreground">
        <span>Created by <strong className="text-foreground/80">{creatorName}</strong></span>
        <span>·</span>
        <span>Edited {timeAgo(file.updatedAt)}</span>

        {/* Save status indicator */}
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-warning/60" />
            Saving...
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-success">
            <Check className="size-3" />
            Saved
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            aria-label={file.isPrivate ? "Make public" : "Make private"}
            onClick={() => handleUpdate({ isPrivate: !file.isPrivate })}
            className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 transition-colors hover:bg-muted/80"
          >
            {file.isPrivate ? <Lock className="size-3" /> : <Globe className="size-3" />}
            {file.isPrivate ? "Private" : "Public"}
          </button>
        </div>
      </div>

      {/* Render based on type — key forces re-mount on navigation */}
      {file.type === "page" && <PageEditor key={file.id} file={file} onUpdate={handleUpdate} />}
      {file.type === "folder" && (
        <FolderView
          folder={file}
          children={children}
          onCreatePage={handleCreatePage}
          onUpload={handleUpload}
        />
      )}
      {file.type === "file" && <FilePreview file={file} />}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
