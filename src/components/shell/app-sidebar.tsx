"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessagesSidebarContent } from "@/components/messages/messages-sidebar-content";
import { ProjectsSidebarContent } from "@/components/projects/projects-sidebar-content";
import { FilesSidebarContent } from "@/components/files/files-sidebar-content";
import { ReportsSidebarContent } from "@/components/reports/reports-sidebar-content";
import { EmailSidebarContent } from "@/components/emails/email-sidebar-content";

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div
        className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
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
        "mx-2 cursor-pointer rounded-md px-3 py-1.5 text-[13px] transition-colors duration-150",
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
      return <FilesSidebarContent />;
    case "reports":
      return <ReportsSidebarContent />;
    case "email-marketing":
      return <EmailSidebarContent />;
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
    <aside
      className="hidden md:flex h-full w-[220px] min-w-[220px] flex-col overflow-y-auto border-r"
      style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-hover)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--sidebar-text)" }}
        >
          {activeApp.name}
        </h2>
        <button
          aria-label={`Add new ${activeApp.name.toLowerCase()} item`}
          className="flex size-6 items-center justify-center rounded-md transition-colors duration-150"
          style={{ color: "var(--sidebar-text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="pt-1">
        {renderSidebarContent(activeApp.id)}
      </div>
    </aside>
  );
}

export { SidebarSection, SidebarItem };
