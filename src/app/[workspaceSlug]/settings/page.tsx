"use client";

import { useState } from "react";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import { THEMES } from "@/lib/workspace/themes";

export default function SettingsPage() {
  const { workspace, members, installedApps } = useWorkspace();
  const isOwner = useIsOwner();
  const [activeTab, setActiveTab] = useState<"members" | "apps" | "workspace">("members");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="text-xl font-semibold mb-6">Workspace Settings</h1>

        <div className="flex gap-1 border-b border-border mb-6">
          {(["members", "apps", "workspace"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "members" && (
          <div className="space-y-6">
            {isOwner && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite members</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email to invite"
                    className="flex-1 h-10 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button className="h-10 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90">
                    Invite
                  </button>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium mb-3">Current members</h3>
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
                      {member.fullName?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{member.fullName || member.email}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "apps" && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Installed apps</h3>
            {installedApps.map((app) => (
              <div key={app.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <span className="text-xs">{app.name[0]}</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{app.name}</div>
                </div>
                {isOwner && (
                  <button className="text-xs text-destructive hover:underline">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "workspace" && isOwner && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Workspace name</label>
              <input
                type="text"
                defaultValue={workspace.name}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme</label>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      workspace.theme === theme.id
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <div className="w-4 h-4 rounded-sm" style={{ background: theme.railBg, border: "1px solid #ddd" }} />
                      <div className="w-4 h-4 rounded-sm" style={{ background: theme.accent }} />
                      <div className="w-4 h-4 rounded-sm" style={{ background: theme.sidebarBg, border: "1px solid #ddd" }} />
                    </div>
                    <div className="text-xs font-medium">{theme.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-medium text-destructive mb-2">Danger zone</h3>
              <button className="text-sm text-destructive border border-destructive/30 px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors">
                Delete workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
