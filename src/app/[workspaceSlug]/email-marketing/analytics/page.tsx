"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { AnalyticsView } from "@/components/emails/analytics-view";

export default function AnalyticsPage() {
  const { workspace } = useWorkspace();
  return (
    <div className="flex-1 overflow-y-auto">
      <AnalyticsView workspaceId={workspace.id} />
    </div>
  );
}
