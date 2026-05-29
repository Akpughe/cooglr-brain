"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { THEMES } from "@/lib/workspace/themes";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import type { WorkspaceInvite } from "@/lib/apps/types";

export default function SettingsPage() {
  const router = useRouter();
  const { workspace, members, installedApps } = useWorkspace();
  const isOwner = useIsOwner();
  const [activeTab, setActiveTab] = useState<"members" | "apps" | "integrations" | "workspace">("members");

  // --- Members tab state ---
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  // --- Apps tab state ---
  const [removingApp, setRemovingApp] = useState<string | null>(null);

  // --- Workspace tab state ---
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [savingName, setSavingName] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteTrapRef = useFocusTrap<HTMLDivElement>(deleteDialogOpen);

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
      <div className="mx-auto max-w-2xl px-8 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Workspace Settings</h1>

        {/* Tab nav */}
        <div className="mb-6 flex gap-1 border-b border-border">
          {(["members", "apps", "integrations", "workspace"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── INTEGRATIONS TAB ── */}
        {activeTab === "integrations" && <IntegrationsTab workspaceId={workspace.id} />}

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
                    className="h-8 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="h-8 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {inviting ? "Sending…" : "Invite"}
                  </button>
                </div>
              </div>
            )}

            {/* Pending invites */}
            {isOwner && (
              <div>
                <h3 className="mb-3 text-sm font-medium">Pending invites</h3>
                {invitesLoading ? (
                  <LoadingSpinner size="sm" />
                ) : pendingInvites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invites</p>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                          {invite.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{invite.email}</div>
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
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium">Current members ({members.length})</h3>
              </div>
              {members.length > 3 && (
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members..."
                  className="mb-3 h-8 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              )}
              <div className="space-y-2">
                {members
                  .filter((m) => {
                    if (!memberSearch) return true;
                    const q = memberSearch.toLowerCase();
                    return m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
                  })
                  .map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                      {member.fullName?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{member.fullName || member.email}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
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
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    {app.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{app.name}</div>
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
                  className="h-8 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                <button
                  onClick={handleSaveName}
                  disabled={
                    savingName ||
                    !workspaceName.trim() ||
                    workspaceName.trim() === workspace.name
                  }
                  className="h-8 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className={`rounded-lg border p-3 text-left transition-all disabled:opacity-60 ${
                      workspace.theme === theme.id
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <div className="mb-2 flex gap-1">
                      <div
                        className="size-4 rounded-sm"
                        style={{ background: theme.railBg, border: "1px solid #ddd" }}
                      />
                      <div className="size-4 rounded-sm" style={{ background: theme.accent }} />
                      <div
                        className="size-4 rounded-sm"
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
              <h3 className="mb-2 text-sm font-medium text-destructive">Danger zone</h3>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="rounded-md border border-destructive/30 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                Delete workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DELETE CONFIRMATION DIALOG ── */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="Delete workspace">
          <div ref={deleteTrapRef} className="mx-4 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-surface-lg">
            <h2 className="mb-1 text-base font-semibold">Delete workspace</h2>
            <p className="mb-4 text-sm text-muted-foreground">
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
              className="mb-4 h-8 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmText("");
                }}
                className="h-8 rounded-md border border-border px-4 text-sm transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={deleting || deleteConfirmText !== workspace.name}
                className="h-8 rounded-md bg-destructive px-4 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
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
