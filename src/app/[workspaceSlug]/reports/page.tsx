"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace/context";
import { ReportBuilder } from "@/components/reports/report-builder";
import { ReportsOnboarding } from "@/components/reports/reports-onboarding";

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
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
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
