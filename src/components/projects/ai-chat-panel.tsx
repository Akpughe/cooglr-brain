"use client";

import { X, Sparkles } from "lucide-react";

interface AiChatPanelProps {
  projectName: string;
  onClose: () => void;
}

export function AiChatPanel({ projectName, onClose }: AiChatPanelProps) {
  return (
    <div className="w-[320px] min-w-[320px] h-full border-l border-border bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Chat</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">AI assistant coming soon</p>
        </div>
      </div>

      <div className="p-3 border-t border-border">
        <div className="border border-border rounded-lg px-3 py-2">
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{projectName}</span>
          <input
            type="text"
            placeholder="Ask anything..."
            disabled
            className="w-full mt-1.5 text-sm bg-transparent focus:outline-none text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}
