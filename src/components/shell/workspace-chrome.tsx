"use client";

import { usePathname } from "next/navigation";
import { IconRail } from "./icon-rail";
import { AppSidebar } from "./app-sidebar";
import { AppRouteGuard } from "./app-route-guard";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";

/**
 * Chrome for the workspace shell. The chat-first agent surface (the workspace
 * home `/:slug` and `/:slug/agent`) renders FULL-SCREEN with no IconRail /
 * AppSidebar — it has its own sidebar. Every other app route keeps the classic
 * icon-rail + contextual sidebar.
 */
export function WorkspaceChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // ["slug", "app", ...]
  const isAgentHome =
    segments.length === 1 || (segments.length === 2 && segments[1] === "agent");

  if (isAgentHome) {
    return <div style={{ height: "100vh", overflow: "hidden" }}>{children}</div>;
  }

  return (
    <>
      <div className="flex h-screen bg-background">
        <IconRail />
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden pb-14 md:pb-0">
          <AppRouteGuard>{children}</AppRouteGuard>
        </main>
        <MobileNav />
      </div>
      <CommandPalette />
    </>
  );
}
