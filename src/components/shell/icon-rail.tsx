"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { WorkspaceSwitcher } from "./workspace-switcher";
import * as LucideIcons from "lucide-react";
import { Plus, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { AppCatalogModal } from "./app-catalog-modal";
import { UserMenu } from "./user-menu";
import Link from "next/link";

function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group/tooltip relative">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-50 opacity-0 scale-95 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-150 origin-left"
      >
        <div className="whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-surface-md">
          {label}
        </div>
      </div>
    </div>
  );
}

function RailButton({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <div className="relative">
        {active && (
          <div
            className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
            style={{ background: "var(--shell-accent)" }}
          />
        )}
        <Link
          href={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-colors duration-150",
            active
              ? "bg-black/[0.06] dark:bg-white/[0.08]"
              : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          )}
          style={{
            color: active ? "var(--rail-icon-active)" : "var(--rail-icon)",
          }}
        >
          {children}
        </Link>
      </div>
    </Tooltip>
  );
}

export function IconRail() {
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();
  const [catalogOpen, setCatalogOpen] = useState(false);

  const workspaceBase = `/${workspace.slug}`;

  // The chat-first agent surface provides its own full-bleed shell.
  if (pathname.startsWith(`${workspaceBase}/agent`)) return null;

  function isActive(route: string): boolean {
    const fullRoute = `${workspaceBase}${route}`;
    if (route === "") return pathname === workspaceBase || pathname === `${workspaceBase}/`;
    return pathname.startsWith(fullRoute);
  }

  function getIcon(iconName: string) {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="size-[18px]" /> : <Sparkles className="size-[18px]" />;
  }

  return (
    <>
      <nav
        aria-label="App navigation"
        className="hidden md:flex h-full w-[52px] min-w-[52px] flex-col items-center gap-1 border-r py-3"
        style={{ background: "var(--rail-bg)", borderColor: "var(--sidebar-hover)" }}
      >
        {/* Workspace avatar */}
        <div className="mb-1">
          <WorkspaceSwitcher activeWorkspace={workspace} />
        </div>

        {/* AI Home */}
        <div className="mt-2">
          <RailButton href={workspaceBase} active={isActive("")} label="AI Home">
            <Sparkles className="size-[18px]" />
          </RailButton>
        </div>

        {/* Divider */}
        <div className="mx-auto my-1 h-px w-5" style={{ background: "var(--sidebar-hover)" }} />

        {/* Installed apps */}
        {installedApps.map((app) => (
          <RailButton
            key={app.id}
            href={`${workspaceBase}${app.route}`}
            active={isActive(app.route)}
            label={app.name}
          >
            {getIcon(app.icon)}
          </RailButton>
        ))}

        {/* Add app button */}
        <Tooltip label="Add app">
          <button
            onClick={() => setCatalogOpen(true)}
            aria-label="Add app"
            className="mt-1 flex size-9 items-center justify-center rounded-lg border border-transparent transition-colors duration-150 hover:border-dashed hover:border-current opacity-50 hover:opacity-80"
            style={{ color: "var(--rail-icon)" }}
          >
            <Plus className="size-4" />
          </button>
        </Tooltip>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <RailButton href={`${workspaceBase}/settings`} active={isActive("/settings")} label="Settings">
          <Settings className="size-[18px]" />
        </RailButton>

        {/* User menu */}
        <UserMenu />
      </nav>

      {catalogOpen && (
        <AppCatalogModal onClose={() => setCatalogOpen(false)} />
      )}
    </>
  );
}
