"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { Plus, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReportSession {
  id: string;
  name: string;
  connectionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ReportsSidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [sessions, setSessions] = useState<ReportSession[]>([]);

  const workspaceBase = `/${workspace.slug}/reports`;

  useEffect(() => {
    fetch(`/api/reports/sessions?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {});
  }, [workspace.id]);

  async function handleNewSession() {
    try {
      const res = await fetch("/api/reports/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => [data.session, ...prev]);
        router.push(`${workspaceBase}/${data.session.id}`);
        toast.success("New report session created");
      }
    } catch {
      toast.error("Failed to create session");
    }
  }

  return (
    <>
      <div className="mb-3">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--sidebar-text-muted)" }}>
            Sessions
          </span>
          <button
            onClick={handleNewSession}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: "var(--sidebar-text-muted)" }}
            title="New report session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-px">
          {sessions.map((session) => {
            const path = `${workspaceBase}/${session.id}`;
            const active = pathname === path;
            return (
              <button
                key={session.id}
                onClick={() => router.push(path)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 mx-2 rounded-md text-[13px] transition-colors text-left",
                  active ? "font-medium" : ""
                )}
                style={{
                  color: active ? "var(--sidebar-text)" : "var(--sidebar-text-muted)",
                  background: active ? "var(--sidebar-hover)" : "transparent",
                  maxWidth: "calc(100% - 16px)",
                }}
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className="truncate">{session.name || "New Report"}</span>
              </button>
            );
          })}
          {sessions.length === 0 && (
            <div className="px-4 py-3">
              <p className="text-xs" style={{ color: "var(--sidebar-text-muted)" }}>No sessions yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
