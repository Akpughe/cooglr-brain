"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { WorkspaceSwitcher } from "./workspace-switcher";
import * as LucideIcons from "lucide-react";
import { Plus, Settings, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AppCatalogModal } from "./app-catalog-modal";
import Link from "next/link";

export function IconRail() {
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();
  const [catalogOpen, setCatalogOpen] = useState(false);

  const workspaceBase = `/${workspace.slug}`;

  function isActive(route: string): boolean {
    const fullRoute = `${workspaceBase}${route}`;
    if (route === "") return pathname === workspaceBase || pathname === `${workspaceBase}/`;
    return pathname.startsWith(fullRoute);
  }

  function getIcon(iconName: string) {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-[18px] h-[18px]" /> : <MessageSquare className="w-[18px] h-[18px]" />;
  }

  return (
    <>
      <div className="w-[52px] min-w-[52px] h-full flex flex-col items-center py-3 gap-1 border-r"
        style={{ background: "var(--rail-bg)", borderColor: "var(--sidebar-hover)" }}
      >
        {/* Workspace switcher */}
        <WorkspaceSwitcher activeWorkspace={workspace} />

        {/* AI Home (platform) */}
        <div className="mt-3">
          <Link
            href={workspaceBase}
            title="AI Home"
            className={cn(
              "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
              isActive("") ? "border-2" : "hover:opacity-80"
            )}
            style={{
              color: isActive("") ? "var(--rail-icon-active)" : "var(--rail-icon)",
              background: isActive("") ? "var(--sidebar-bg)" : "transparent",
              borderColor: isActive("") ? "var(--rail-icon-active)" : "transparent",
            }}
          >
            <MessageSquare className="w-[18px] h-[18px]" />
          </Link>
        </div>

        {/* Divider */}
        <div className="w-5 h-px my-1" style={{ background: "var(--sidebar-hover)" }} />

        {/* Installed apps */}
        {installedApps.map((app) => (
          <Link
            key={app.id}
            href={`${workspaceBase}${app.route}`}
            title={app.name}
            className={cn(
              "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
              isActive(app.route) ? "border-2" : "hover:opacity-80"
            )}
            style={{
              color: isActive(app.route) ? "var(--rail-icon-active)" : "var(--rail-icon)",
              background: isActive(app.route) ? "var(--sidebar-bg)" : "transparent",
              borderColor: isActive(app.route) ? "var(--rail-icon-active)" : "transparent",
            }}
          >
            {getIcon(app.icon)}
          </Link>
        ))}

        {/* Add app button */}
        <button
          onClick={() => setCatalogOpen(true)}
          title="Add app"
          className="w-[38px] h-[38px] rounded-[10px] border-2 border-dashed flex items-center justify-center mt-1 hover:opacity-80 transition-opacity"
          style={{ borderColor: "var(--rail-icon)", color: "var(--rail-icon)" }}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <Link
          href={`${workspaceBase}/settings`}
          title="Settings"
          className={cn(
            "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
            isActive("/settings") ? "border-2" : "hover:opacity-80"
          )}
          style={{
            color: isActive("/settings") ? "var(--rail-icon-active)" : "var(--rail-icon)",
            background: isActive("/settings") ? "var(--sidebar-bg)" : "transparent",
            borderColor: isActive("/settings") ? "var(--rail-icon-active)" : "transparent",
          }}
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>

        {/* User avatar */}
        <div className="w-[30px] h-[30px] rounded-full bg-foreground mt-1 cursor-pointer" title="User settings" />
      </div>

      {catalogOpen && (
        <AppCatalogModal onClose={() => setCatalogOpen(false)} />
      )}
    </>
  );
}
