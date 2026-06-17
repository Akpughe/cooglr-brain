import { FileText, Download } from "lucide-react";
import type { Attachment } from "@/lib/messages/types";

export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.type.startsWith("image/");

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={attachment.url} alt={attachment.name} className="max-w-[300px] max-h-[200px] rounded-lg border border-border object-cover" />
      </a>
    );
  }

  const sizeStr = attachment.size < 1024 * 1024
    ? `${Math.round(attachment.size / 1024)} KB`
    : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 mt-1 p-3 border border-border rounded-lg hover:bg-muted transition-colors max-w-[300px]">
      <FileText className="size-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{attachment.name}</div>
        <div className="text-xs text-muted-foreground">{sizeStr}</div>
      </div>
      <Download className="size-4 text-muted-foreground shrink-0" />
    </a>
  );
}
