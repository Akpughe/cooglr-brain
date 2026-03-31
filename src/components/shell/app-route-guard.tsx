"use client";

import { usePathname } from "next/navigation";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import { APP_REGISTRY } from "@/lib/apps/registry";
import { useState } from "react";

export function AppRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();
  const isOwner = useIsOwner();
  const [installing, setInstalling] = useState(false);

  const workspaceBase = `/${workspace.slug}`;

  // Extract the app route from the pathname
  // e.g., /my-workspace/reports → /reports
  const relativePath = pathname.replace(workspaceBase, "");

  // Platform routes that don't need app checks (root = AI Home, settings)
  if (!relativePath || relativePath === "/" || relativePath.startsWith("/settings")) {
    return <>{children}</>;
  }

  // Find which app this route belongs to
  const matchedApp = APP_REGISTRY.find((app) =>
    relativePath.startsWith(app.route)
  );

  // If no app matches this route, just render (could be a 404, let Next.js handle it)
  if (!matchedApp) {
    return <>{children}</>;
  }

  // Check if the app is installed
  const isInstalled = installedApps.some((a) => a.id === matchedApp.id);

  if (isInstalled) {
    return <>{children}</>;
  }

  // App is not installed — show install prompt
  async function handleInstall() {
    setInstalling(true);
    try {
      await fetch(`/api/workspaces/${workspace.id}/apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: matchedApp!.id }),
      });
      window.location.reload();
    } catch {
      setInstalling(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto text-muted-foreground text-lg">
          {matchedApp.name[0]}
        </div>
        <h1 className="text-xl font-semibold">{matchedApp.name} is not installed</h1>
        <p className="text-muted-foreground text-sm">
          {isOwner
            ? "Install this app to start using it in your workspace."
            : "Ask your workspace owner to install this app."}
        </p>
        {isOwner && (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="inline-flex items-center justify-center h-10 px-6 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {installing ? "Installing..." : `Install ${matchedApp.name}`}
          </button>
        )}
      </div>
    </div>
  );
}
