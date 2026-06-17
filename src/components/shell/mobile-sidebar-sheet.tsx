"use client";

import { useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import * as LucideIcons from "lucide-react";
import { Sparkles, Settings, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface MobileSidebarSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebarSheet({ open, onClose }: MobileSidebarSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, installedApps } = useWorkspace();

  const workspaceBase = `/${workspace.slug}`;

  function isActive(route: string): boolean {
    const fullRoute = `${workspaceBase}${route}`;
    if (route === "")
      return pathname === workspaceBase || pathname === `${workspaceBase}/`;
    return pathname.startsWith(fullRoute);
  }

  function getIcon(iconName: string) {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="size-4" /> : <Sparkles className="size-4" />;
  }

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  // Close when pathname changes (user navigated)
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="absolute left-0 top-0 bottom-0 w-[280px] bg-background animate-in slide-in-from-left duration-200 flex flex-col shadow-lg"
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold truncate">
            {workspace.name}
          </span>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex size-8 items-center justify-center rounded-md transition-colors duration-150 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* AI Home */}
          <Link
            href={workspaceBase}
            aria-label="AI Home"
            aria-current={isActive("") ? "page" : undefined}
            className={cn(
              "mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
              isActive("")
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Sparkles className="size-4" />
            AI Home
          </Link>

          {/* Divider */}
          <div className="mx-4 my-2 h-px bg-border" />

          {/* All installed apps */}
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Apps
          </div>
          {installedApps.map((app) => (
            <Link
              key={app.id}
              href={`${workspaceBase}${app.route}`}
              aria-label={app.name}
              aria-current={isActive(app.route) ? "page" : undefined}
              className={cn(
                "mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                isActive(app.route)
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {getIcon(app.icon)}
              {app.name}
            </Link>
          ))}

          {/* Divider */}
          <div className="mx-4 my-2 h-px bg-border" />

          {/* Settings */}
          <Link
            href={`${workspaceBase}/settings`}
            aria-label="Settings"
            aria-current={isActive("/settings") ? "page" : undefined}
            className={cn(
              "mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
              isActive("/settings")
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </div>

        {/* Sign out at bottom */}
        <div className="border-t border-border p-2">
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}
