"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { Download, File } from "lucide-react";
import type { FileNode } from "@/lib/files/types";

interface Props {
  file: FileNode;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
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

function getPublicUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/file-uploads/${storagePath}`;
}

export function FilePreview({ file }: Props) {
  const { members } = useWorkspace();

  const uploaderName = members.find((m) => m.userId === file.createdBy)?.fullName || "Unknown";
  const url = file.storagePath ? getPublicUrl(file.storagePath) : "";
  const isImage = file.mimeType?.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";
  const isVideo = file.mimeType?.startsWith("video/");
  const isAudio = file.mimeType?.startsWith("audio/");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[32px]">{file.icon || "📎"}</span>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{file.title}</h1>
            <p className="text-sm text-muted-foreground">
              {file.mimeType?.split("/")[1]?.toUpperCase() || "File"} · {formatSize(file.fileSize)} · Uploaded by {uploaderName} · {timeAgo(file.createdAt)}
            </p>
          </div>
          {url && (
            <a
              href={url}
              download={file.title}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          )}
        </div>

        <div className="rounded-lg overflow-hidden border border-white/[0.06]">
          {isImage && url ? (
            <img src={url} alt={file.title} className="w-full object-contain max-h-[600px] bg-black/20" />
          ) : isPdf && url ? (
            <iframe src={url} className="w-full h-[600px]" title={file.title} />
          ) : isVideo && url ? (
            <video src={url} controls className="w-full max-h-[600px]" />
          ) : isAudio && url ? (
            <div className="p-8 flex items-center justify-center bg-white/[0.02]">
              <audio src={url} controls className="w-full max-w-md" />
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white/[0.02]">
              <File className="w-16 h-16 text-muted-foreground/30" />
              <p className="text-muted-foreground">No preview available</p>
              {url && (
                <a
                  href={url}
                  download={file.title}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  Download file
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
