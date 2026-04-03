"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { AudiencesView } from "@/components/emails/audiences-view";

export default function AudiencesPage() {
  const { workspace } = useWorkspace();
  return (
    <div className="flex-1 overflow-y-auto">
      <AudiencesView workspaceId={workspace.id} />
    </div>
  );
}
