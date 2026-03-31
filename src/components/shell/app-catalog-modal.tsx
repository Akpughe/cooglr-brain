"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import * as LucideIcons from "lucide-react";
import { X, MessageSquare } from "lucide-react";
import type { AppManifest } from "@/lib/apps/types";

interface AppCatalogModalProps {
  onClose: () => void;
}

export function AppCatalogModal({ onClose }: AppCatalogModalProps) {
  const { workspace, installedApps } = useWorkspace();
  const isOwner = useIsOwner();
  const router = useRouter();
  const [allApps, setAllApps] = useState<AppManifest[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/apps/registry")
      .then((r) => r.json())
      .then((data) => setAllApps(data.apps || []));
  }, []);

  const installedIds = new Set(installedApps.map((a) => a.id));

  function getIcon(iconName: string) {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />;
  }

  async function installApp(appId: string) {
    setInstalling(appId);
    await fetch(`/api/workspaces/${workspace.id}/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId }),
    });
    router.refresh();
    onClose();
  }

  const builtIn = allApps.filter((a) => a.category === "built_in");
  const addOns = allApps.filter((a) => a.category === "add_on");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-popover rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">App Catalog</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {builtIn.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Built-in</h3>
              <div className="space-y-2">
                {builtIn.map((app) => (
                  <AppRow key={app.id} app={app} installed={installedIds.has(app.id)} installing={installing === app.id} canInstall={isOwner} onInstall={() => installApp(app.id)} getIcon={getIcon} />
                ))}
              </div>
            </div>
          )}

          {addOns.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Add-ons</h3>
              <div className="space-y-2">
                {addOns.map((app) => (
                  <AppRow key={app.id} app={app} installed={installedIds.has(app.id)} installing={installing === app.id} canInstall={isOwner} onInstall={() => installApp(app.id)} getIcon={getIcon} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppRow({ app, installed, installing, canInstall, onInstall, getIcon }: {
  app: AppManifest; installed: boolean; installing: boolean; canInstall: boolean; onInstall: () => void; getIcon: (name: string) => React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        {getIcon(app.icon)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{app.name}</div>
        <div className="text-xs text-muted-foreground truncate">{app.description}</div>
      </div>
      {installed ? (
        <span className="text-xs text-muted-foreground px-3 py-1 bg-muted rounded-full">Installed</span>
      ) : canInstall ? (
        <button onClick={onInstall} disabled={installing} className="text-xs font-medium px-3 py-1 bg-foreground text-background rounded-full hover:opacity-90 transition-opacity disabled:opacity-50">
          {installing ? "..." : "Install"}
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">Ask owner</span>
      )}
    </div>
  );
}
