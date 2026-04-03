"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { ReportBuilder } from "@/components/reports/report-builder";

export default function ReportsPage() {
  const { workspace } = useWorkspace();

  return (
    <div className="flex-1 overflow-y-auto">
      <ReportBuilder workspaceId={workspace.id} />
    </div>
  );
}
