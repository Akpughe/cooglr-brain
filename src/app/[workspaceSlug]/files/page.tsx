import { FileText } from "lucide-react";

export default function FilesPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <FileText className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Files</h1>
          <p className="text-muted-foreground text-sm max-w-xs">Documents, notes, and file storage</p>
        </div>
      </div>
    </div>
  );
}
