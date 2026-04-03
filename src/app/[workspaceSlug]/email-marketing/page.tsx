"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { Mail } from "lucide-react";

export default function EmailMarketingPage() {
  const { workspace } = useWorkspace();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Email Marketing</h1>
            <p className="text-sm text-muted-foreground">Campaigns, templates, and audience management</p>
          </div>
        </div>

        <p className="text-muted-foreground">Select a section from the sidebar to get started.</p>
      </div>
    </div>
  );
}
