"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import * as LucideIcons from "lucide-react";
import { Sparkles, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { MobileSidebarSheet } from "./mobile-sidebar-sheet";

export function MobileNav() {
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();
  const [moreOpen, setMoreOpen] = useState(false);

  const workspaceBase = `/${workspace.slug}`;

  // The chat-first agent surface provides its own shell + composer.
  if (pathname.startsWith(`${workspaceBase}/agent`)) return null;

  function isActive(route: string): boolean {
    const fullRoute = `${workspaceBase}${route}`;
    if (route === "")
      return pathname === workspaceBase || pathname === `${workspaceBase}/`;
    return pathname.startsWith(fullRoute);
  }

  function getIcon(iconName: string) {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="size-5" /> : <Sparkles className="size-5" />;
  }

  // Show up to 4 installed apps in the bottom bar
  const visibleApps = installedApps.slice(0, 4);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden h-14 items-center justify-around border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        {/* AI Home */}
        <Link
          href={workspaceBase}
          aria-label="AI Home"
          aria-current={isActive("") ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150",
            isActive("") ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {isActive("") && (
            <div className="size-1 rounded-full bg-primary" />
          )}
          <Sparkles className="size-5" />
          <span className="text-[10px]">AI Home</span>
        </Link>

        {/* Installed apps (up to 4) */}
        {visibleApps.map((app) => (
          <Link
            key={app.id}
            href={`${workspaceBase}${app.route}`}
            aria-label={app.name}
            aria-current={isActive(app.route) ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150",
              isActive(app.route)
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {isActive(app.route) && (
              <div className="size-1 rounded-full bg-primary" />
            )}
            {getIcon(app.icon)}
            <span className="text-[10px] truncate max-w-[60px]">
              {app.name}
            </span>
          </Link>
        ))}

        {/* More button */}
        <button
          aria-label="More options"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150 text-muted-foreground"
          )}
        >
          <MoreHorizontal className="size-5" />
          <span className="text-[10px]">More</span>
        </button>
      </nav>

      <MobileSidebarSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
