"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { TemplatesView } from "@/components/emails/templates-view";

export default function TemplatesPage() {
  const { workspace } = useWorkspace();
  return (
    <div className="flex-1 overflow-y-auto">
      <TemplatesView workspaceId={workspace.id} />
    </div>
  );
}
