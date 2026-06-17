"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace/context";
import { ReportBuilder } from "@/components/reports/report-builder";
import { ReportsOnboarding } from "@/components/reports/reports-onboarding";
import { PageLoading } from "@/components/ui/loading-spinner";

export default function ReportsPage() {
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  function checkConnections() {
    fetch(`/api/db/connections?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => {
        // API returns a plain array
        const connections = Array.isArray(data) ? data : [];
        setNeedsOnboarding(connections.length === 0);
        setLoading(false);
      })
      .catch(() => {
        setNeedsOnboarding(true);
        setLoading(false);
      });
  }

  useEffect(() => { checkConnections(); }, [workspace.id]);

  if (loading) {
    return <PageLoading />;
  }

  if (needsOnboarding) {
    return (
      <ReportsOnboarding
        workspaceId={workspace.id}
        onComplete={() => {
          setNeedsOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <ReportBuilder workspaceId={workspace.id} />
    </div>
  );
}
