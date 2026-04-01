"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessagesSidebarContent } from "@/components/messages/messages-sidebar-content";
import { ProjectsSidebarContent } from "@/components/projects/projects-sidebar-content";

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div
        className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider"
        style={{ color: "var(--sidebar-text-muted)" }}
      >
        {label}
      </div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function SidebarItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-[13px] rounded-md mx-2 cursor-pointer transition-colors duration-150",
        active ? "font-medium" : ""
      )}
      style={{
        color: active ? "var(--sidebar-text)" : "var(--sidebar-text-muted)",
        background: active ? "var(--sidebar-hover)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
    </div>
  );
}

function renderSidebarContent(appId: string) {
  switch (appId) {
    case "messages":
      return <MessagesSidebarContent />;
    case "projects":
      return <ProjectsSidebarContent />;
    case "files":
      return (
        <>
          <SidebarSection label="My Files">
            <SidebarItem label="All files" active />
          </SidebarSection>
          <SidebarSection label="Shared with me">
            <SidebarItem label="Recent" />
          </SidebarSection>
        </>
      );
    default:
      return (
        <div className="px-4 py-6">
          <p className="text-[13px]" style={{ color: "var(--sidebar-text-muted)" }}>
            Get started
          </p>
        </div>
      );
  }
}

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2
          className="font-bold text-[14px]"
          style={{ color: "var(--sidebar-text)" }}
        >
          {activeApp.name}
        </h2>
        <button
          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-150"
          style={{ color: "var(--sidebar-text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="pt-1">
        {renderSidebarContent(activeApp.id)}
      </div>
    </div>
  );
}
