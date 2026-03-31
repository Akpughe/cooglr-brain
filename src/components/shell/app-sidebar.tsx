"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";

export function AppSidebar() {
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();

  const workspaceBase = `/${workspace.slug}`;

  const activeApp = installedApps.find((app) =>
    pathname.startsWith(`${workspaceBase}${app.route}`)
  );

  // AI Home and Settings have no sidebar
  if (!activeApp || !activeApp.hasSidebar) {
    if (pathname === workspaceBase || pathname === `${workspaceBase}/` || pathname.startsWith(`${workspaceBase}/settings`)) {
      return null;
    }
  }

  if (!activeApp) return null;

  return (
    <div
      className="w-[220px] min-w-[220px] h-full border-r flex flex-col overflow-y-auto"
      style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-hover)" }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2
          className="font-semibold text-[15px]"
          style={{ color: "var(--sidebar-text)" }}
        >
          {activeApp.name}
        </h2>
      </div>

      <div className="px-4 py-2">
        <p className="text-xs" style={{ color: "var(--sidebar-text-muted)" }}>
          {activeApp.name} sidebar content will be implemented in the {activeApp.name} sub-project.
        </p>
      </div>
    </div>
  );
}
