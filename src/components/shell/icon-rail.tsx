"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { WorkspaceSwitcher } from "./workspace-switcher";
import * as LucideIcons from "lucide-react";
import { Plus, Settings, Sparkles, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { AppCatalogModal } from "./app-catalog-modal";
import { UserMenu } from "./user-menu";
import Link from "next/link";

function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group/tooltip relative">
      {children}
      <div className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-50 opacity-0 scale-95 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-150 origin-left">
        <div className="whitespace-nowrap rounded-lg bg-foreground text-background px-2.5 py-1 text-xs font-medium shadow-lg">
          {label}
        </div>
      </div>
    </div>
  );
}

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
    return Icon ? <Icon className="w-[18px] h-[18px]" /> : <Sparkles className="w-[18px] h-[18px]" />;
  }

  return (
    <>
      <div
        className="w-[52px] min-w-[52px] h-full flex flex-col items-center py-3 gap-1 border-r"
        style={{ background: "var(--rail-bg)", borderColor: "var(--sidebar-hover)" }}
      >
        {/* Workspace avatar */}
        <div className="mb-1">
          <WorkspaceSwitcher activeWorkspace={workspace} />
        </div>

        {/* AI Home */}
        <Tooltip label="AI Home">
          <div className="relative mt-2">
            {isActive("") && (
              <div
                className="absolute left-[-7px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
                style={{ background: "var(--shell-accent)" }}
              />
            )}
            <Link
              href={workspaceBase}
              className={cn(
                "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
                isActive("") ? "bg-black/[0.06] dark:bg-white/[0.08]" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
              style={{
                color: isActive("") ? "var(--rail-icon-active)" : "var(--rail-icon)",
              }}
            >
              <Sparkles className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </Tooltip>

        {/* Divider */}
        <div className="w-5 h-px my-1" style={{ background: "var(--sidebar-hover)" }} />

        {/* Installed apps */}
        {installedApps.map((app) => (
          <Tooltip key={app.id} label={app.name}>
            <div className="relative">
              {isActive(app.route) && (
                <div
                  className="absolute left-[-7px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
                  style={{ background: "var(--shell-accent)" }}
                />
              )}
              <Link
                href={`${workspaceBase}${app.route}`}
                className={cn(
                  "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
                  isActive(app.route) ? "bg-black/[0.06] dark:bg-white/[0.08]" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                )}
                style={{
                  color: isActive(app.route) ? "var(--rail-icon-active)" : "var(--rail-icon)",
                }}
              >
                {getIcon(app.icon)}
              </Link>
            </div>
          </Tooltip>
        ))}

        {/* Add app button */}
        <Tooltip label="Add app">
          <button
            onClick={() => setCatalogOpen(true)}
            className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center mt-1 transition-all duration-150 border border-transparent hover:border-dashed hover:border-current opacity-40 hover:opacity-70"
            style={{ color: "var(--rail-icon)" }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </Tooltip>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <Tooltip label="Settings">
          <div className="relative">
            {isActive("/settings") && (
              <div
                className="absolute left-[-7px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
                style={{ background: "var(--shell-accent)" }}
              />
            )}
            <Link
              href={`${workspaceBase}/settings`}
              className={cn(
                "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
                isActive("/settings") ? "bg-black/[0.06] dark:bg-white/[0.08]" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
              style={{
                color: isActive("/settings") ? "var(--rail-icon-active)" : "var(--rail-icon)",
              }}
            >
              <Settings className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </Tooltip>

        {/* User menu */}
        <UserMenu />
      </div>

      {catalogOpen && (
        <AppCatalogModal onClose={() => setCatalogOpen(false)} />
      )}
    </>
  );
}
