"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import { THEMES } from "@/lib/workspace/themes";
import type { WorkspaceInvite } from "@/lib/apps/types";

export default function SettingsPage() {
  const router = useRouter();
  const { workspace, members, installedApps } = useWorkspace();
  const isOwner = useIsOwner();
  const [activeTab, setActiveTab] = useState<"members" | "apps" | "workspace">("members");

  // --- Members tab state ---
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  // --- Apps tab state ---
  const [removingApp, setRemovingApp] = useState<string | null>(null);

  // --- Workspace tab state ---
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [savingName, setSavingName] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Fetch pending invites when Members tab is active
  const fetchInvites = useCallback(async () => {
    if (!isOwner) return;
    setInvitesLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/invites`);
      const data = await res.json();
      if (res.ok) {
        setPendingInvites(data.invites ?? []);
      } else {
        toast.error(data.error ?? "Failed to load invites");
      }
    } catch {
      toast.error("Failed to load invites");
    } finally {
      setInvitesLoading(false);
    }
  }, [workspace.id, isOwner]);

  useEffect(() => {
    if (activeTab === "members") {
      fetchInvites();
    }
  }, [activeTab, fetchInvites]);

  // --- Members: Invite ---
  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: [inviteEmail.trim()] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send invite");
        return;
      }
      const result = data.results?.[0];
      if (result?.status === "already_invited") {
        toast.info(`${inviteEmail.trim()} already has a pending invite`);
      } else {
        toast.success(`Invite sent to ${inviteEmail.trim()}`);
        setInviteEmail("");
        await fetchInvites();
      }
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  // --- Members: Revoke invite ---
  async function handleRevokeInvite(inviteId: string, email: string) {
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/invites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action: "revoke" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to revoke invite");
        return;
      }
      toast.success(`Invite to ${email} revoked`);
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch {
      toast.error("Failed to revoke invite");
    }
  }

  // --- Members: Remove member ---
  async function handleRemoveMember(userId: string, displayName: string) {
    if (!confirm(`Remove ${displayName} from this workspace?`)) return;
    setRemovingMember(userId);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to remove member");
        return;
      }
      toast.success(`${displayName} removed from workspace`);
      router.refresh();
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingMember(null);
    }
  }

  // --- Apps: Remove app ---
  async function handleRemoveApp(appId: string, appName: string) {
    if (!confirm(`Remove ${appName} from this workspace?`)) return;
    setRemovingApp(appId);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/apps`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to remove app");
        return;
      }
      toast.success(`${appName} removed`);
      router.refresh();
    } catch {
      toast.error("Failed to remove app");
    } finally {
      setRemovingApp(null);
    }
  }

  // --- Workspace: Save name ---
  async function handleSaveName() {
    const trimmed = workspaceName.trim();
    if (!trimmed || trimmed === workspace.name) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save name");
        return;
      }
      toast.success("Workspace name updated");
      router.refresh();
    } catch {
      toast.error("Failed to save name");
    } finally {
      setSavingName(false);
    }
  }

  // --- Workspace: Change theme ---
  async function handleThemeChange(themeId: string) {
    if (themeId === workspace.theme) return;
    setSavingTheme(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: themeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to apply theme");
        return;
      }
      toast.success("Theme updated");
      router.refresh();
    } catch {
      toast.error("Failed to apply theme");
    } finally {
      setSavingTheme(false);
    }
  }

  // --- Workspace: Delete workspace ---
  async function handleDeleteWorkspace() {
    if (deleteConfirmText !== workspace.name) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete workspace");
        return;
      }
      toast.success("Workspace deleted");
      router.push("/");
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="text-xl font-semibold mb-6">Workspace Settings</h1>

        {/* Tab nav */}
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

        {/* ── MEMBERS TAB ── */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {isOwner && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite members</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    placeholder="Enter email to invite"
                    className="flex-1 h-10 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="h-10 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inviting ? "Sending…" : "Invite"}
                  </button>
                </div>
              </div>
            )}

            {/* Pending invites */}
            {isOwner && (
              <div>
                <h3 className="text-sm font-medium mb-3">Pending invites</h3>
                {invitesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : pendingInvites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invites</p>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center gap-3 p-3 border border-border rounded-xl"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 text-muted-foreground">
                          {invite.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{invite.email}</div>
                          <div className="text-xs text-muted-foreground">Pending invite</div>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(invite.id, invite.email)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Current members */}
            <div>
              <h3 className="text-sm font-medium mb-3">Current members</h3>
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 border border-border rounded-xl"
                  >
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
                    {isOwner && member.role !== "owner" && (
                      <button
                        onClick={() =>
                          handleRemoveMember(
                            member.userId,
                            member.fullName || member.email
                          )
                        }
                        disabled={removingMember === member.userId}
                        className="text-xs text-destructive hover:underline disabled:opacity-50"
                      >
                        {removingMember === member.userId ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── APPS TAB ── */}
        {activeTab === "apps" && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Installed apps</h3>
            {installedApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No apps installed yet.</p>
            ) : (
              installedApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center gap-3 p-3 border border-border rounded-xl"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <span className="text-xs">{app.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{app.name}</div>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveApp(app.id, app.name)}
                      disabled={removingApp === app.id}
                      className="text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      {removingApp === app.id ? "Removing…" : "Remove"}
                    </button>
                  )}
                </div>
              ))
            )}

            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                Browse more apps via the{" "}
                <span className="font-medium text-foreground">+ button</span> in the sidebar.
              </p>
            </div>
          </div>
        )}

        {/* ── WORKSPACE TAB ── */}
        {activeTab === "workspace" && isOwner && (
          <div className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Workspace name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="flex-1 h-10 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={handleSaveName}
                  disabled={
                    savingName ||
                    !workspaceName.trim() ||
                    workspaceName.trim() === workspace.name
                  }
                  className="h-10 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingName ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme</label>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    disabled={savingTheme}
                    className={`p-3 rounded-xl border text-left transition-all disabled:opacity-60 ${
                      workspace.theme === theme.id
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <div
                        className="w-4 h-4 rounded-sm"
                        style={{ background: theme.railBg, border: "1px solid #ddd" }}
                      />
                      <div className="w-4 h-4 rounded-sm" style={{ background: theme.accent }} />
                      <div
                        className="w-4 h-4 rounded-sm"
                        style={{ background: theme.sidebarBg, border: "1px solid #ddd" }}
                      />
                    </div>
                    <div className="text-xs font-medium">{theme.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-medium text-destructive mb-2">Danger zone</h3>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="text-sm text-destructive border border-destructive/30 px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                Delete workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DELETE CONFIRMATION DIALOG ── */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-xl mx-4">
            <h2 className="text-base font-semibold mb-1">Delete workspace</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This action is permanent and cannot be undone. All data will be deleted.
              Type{" "}
              <span className="font-medium text-foreground">{workspace.name}</span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={workspace.name}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmText("");
                }}
                className="h-9 px-4 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={deleting || deleteConfirmText !== workspace.name}
                className="h-9 px-4 text-sm rounded-lg bg-destructive text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Deleting…" : "Delete workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
