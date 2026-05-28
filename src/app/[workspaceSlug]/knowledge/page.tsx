"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { KnowledgeView } from "@/components/knowledge/knowledge-view";

export default function KnowledgePage() {
  const { workspace } = useWorkspace();
  return (
    <div className="flex-1 overflow-y-auto">
      <KnowledgeView workspaceId={workspace.id} />
    </div>
  );
}
