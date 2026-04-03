"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { CampaignsView } from "@/components/emails/campaigns-view";

export default function CampaignsPage() {
  const { workspace } = useWorkspace();
  return (
    <div className="flex-1 overflow-y-auto">
      <CampaignsView workspaceId={workspace.id} />
    </div>
  );
}
