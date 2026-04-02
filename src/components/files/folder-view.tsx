"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { FilePlus, Upload, Folder, FileText, File } from "lucide-react";
import type { FileNode } from "@/lib/files/types";

interface Props {
  folder: FileNode;
  children: FileNode[];
  onCreatePage: (parentId: string) => void;
  onUpload: (parentId: string) => void;
}

function getIcon(type: string) {
  switch (type) {
    case "folder": return <Folder className="w-4 h-4 text-yellow-400/70" />;
    case "page": return <FileText className="w-4 h-4 text-blue-400/70" />;
    case "file": return <File className="w-4 h-4 text-gray-400/70" />;
  }
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export function FolderView({ folder, children, onCreatePage, onUpload }: Props) {
  const router = useRouter();
  const { workspace, members } = useWorkspace();

  const sorted = [...children].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.position - b.position;
  });

  function getMemberName(userId: string) {
    const member = members.find((m) => m.userId === userId);
    return member?.fullName || "Unknown";
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[32px]">{folder.icon || "📁"}</span>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{folder.title}</h1>
            <p className="text-sm text-muted-foreground">{sorted.length} items</p>
          </div>
          <button
            onClick={() => onCreatePage(folder.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" /> New page
          </button>
          <button
            onClick={() => onUpload(folder.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <Folder className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">This folder is empty</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Create a page or upload a file to get started</p>
          </div>
        ) : (
          <div className="border border-white/[0.06] rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px_100px] px-4 py-2 bg-white/[0.02] text-[11px] uppercase tracking-wider text-muted-foreground/50 border-b border-white/[0.06]">
              <span>Name</span>
              <span>Type</span>
              <span>Modified</span>
              <span>Created by</span>
            </div>
            {sorted.map((child) => (
              <div
                key={child.id}
                className="grid grid-cols-[1fr_120px_120px_100px] px-4 py-2.5 border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.03] transition-colors items-center"
                onClick={() => router.push(`/${workspace.slug}/files/${child.id}`)}
              >
                <span className="flex items-center gap-2 text-[13px]">
                  {getIcon(child.type)}
                  <span className="truncate">{child.title}</span>
                </span>
                <span className="text-[12px] text-muted-foreground/50">
                  {child.type === "file" ? `${child.mimeType?.split("/")[1] || "File"} · ${formatSize(child.fileSize)}` : child.type === "folder" ? "Folder" : "Page"}
                </span>
                <span className="text-[12px] text-muted-foreground/50">{timeAgo(child.updatedAt)}</span>
                <span className="text-[12px] text-muted-foreground/50">{getMemberName(child.createdBy)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
