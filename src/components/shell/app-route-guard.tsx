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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-xl text-muted-foreground">
        {matchedApp.name[0]}
      </div>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold">{matchedApp.name} is not installed</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          {isOwner
            ? "Install this app to start using it in your workspace."
            : "Ask your workspace owner to install this app."}
        </p>
      </div>
      {isOwner && (
        <button
          onClick={handleInstall}
          disabled={installing}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {installing ? "Installing..." : `Install ${matchedApp.name}`}
        </button>
      )}
    </div>
  );
}
