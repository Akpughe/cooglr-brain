"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ChevronDown,
  UserPlus,
  MoreHorizontal,
  Plug,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import type { WorkspaceMember } from "@/lib/apps/types";
import { AgentInviteModal } from "@/components/agent-shell/agent-invite-modal";

type TabId = "general" | "members" | "integrations" | "meetings";

function formatJoinedDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "members", label: "Members" },
  { id: "integrations", label: "Integrations" },
  { id: "meetings", label: "Meetings" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
      {children}
    </div>
  );
}

function FieldHelper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
      {children}
    </div>
  );
}

function ComingSoon({
  icon: Icon,
  title,
}: {
  icon: typeof Plug;
  title: string;
}) {
  return (
    <div
      style={{
        marginTop: 28,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "72px 0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--hover-soft)",
          color: "var(--ink-3)",
        }}
      >
        <Icon size={22} />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ink-2)" }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Coming soon</div>
    </div>
  );
}

export function AgentSettingsView() {
  const { workspace, members, currentUserId } = useWorkspace();
  const isOwner = useIsOwner();
  const [tab, setTab] = useState<TabId>("general");
  const [name, setName] = useState(workspace.name);
  const [personaName, setPersonaName] = useState("All");
  const [personaInstructions, setPersonaInstructions] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  // Local copy of members so removals reflect immediately in the UI.
  const [localMembers, setLocalMembers] = useState<WorkspaceMember[]>(members);
  useEffect(() => {
    setLocalMembers(members);
  }, [members]);

  const handleRemoveMember = async (member: WorkspaceMember) => {
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Failed to remove member");
        return;
      }
      setLocalMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return localMembers;
    return localMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [localMembers, memberQuery]);

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: "var(--bg)",
      }}
    >
      <div
        className="pane"
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "8px 40px 60px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            paddingTop: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 27,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Settings
            </h1>
            <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 4 }}>
              Manage your workspace
            </div>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                marginTop: 4,
                height: 36,
                padding: "0 16px",
                borderRadius: 10,
                border: "none",
                background: "var(--hover-soft)",
                color: "var(--ink-2)",
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--hover-soft)")
              }
            >
              <UserPlus size={15} />
              Invite
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  height: 34,
                  padding: "0 16px",
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: 500,
                  border: active ? "none" : "1px solid var(--line)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.14s ease, color 0.14s ease",
                  background: active ? "var(--hover-soft)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-2)",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background = "var(--hover-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "general" && (
          <GeneralTab
            isOwner={isOwner}
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            name={name}
            setName={setName}
            personaName={personaName}
            setPersonaName={setPersonaName}
            personaInstructions={personaInstructions}
            setPersonaInstructions={setPersonaInstructions}
          />
        )}

        {tab === "members" && (
          <MembersTab
            isOwner={isOwner}
            currentUserId={currentUserId}
            members={filteredMembers}
            totalCount={localMembers.length}
            query={memberQuery}
            setQuery={setMemberQuery}
            onRemoveMember={handleRemoveMember}
          />
        )}

        {tab === "integrations" && (
          <ComingSoon icon={Plug} title="Integrations" />
        )}

        {tab === "meetings" && (
          <ComingSoon icon={CalendarClock} title="Meetings" />
        )}
      </div>

      {inviteOpen && <AgentInviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function GeneralTab({
  isOwner,
  workspaceId,
  workspaceName,
  name,
  setName,
  personaName,
  setPersonaName,
  personaInstructions,
  setPersonaInstructions,
}: {
  isOwner: boolean;
  workspaceId: string;
  workspaceName: string;
  name: string;
  setName: (v: string) => void;
  personaName: string;
  setPersonaName: (v: string) => void;
  personaInstructions: string;
  setPersonaInstructions: (v: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Workspace name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Failed to save changes");
        return;
      }
      toast("Changes saved");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 28 }}>
      <SectionLabel>Workspace</SectionLabel>

      {/* Workspace logo */}
      <div style={{ marginTop: 20 }}>
        <FieldLabel>Workspace logo</FieldLabel>
        <FieldHelper>Recommended size is 256 × 256px</FieldHelper>
        <button
          type="button"
          disabled={!isOwner}
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: 0,
            border: "none",
            background: "transparent",
            fontFamily: "inherit",
            opacity: isOwner ? 1 : 0.6,
            cursor: isOwner ? "pointer" : "default",
          }}
        >
          <span style={{ fontSize: 17, color: "var(--ink-2)", fontWeight: 600 }}>
            {workspaceName}
          </span>
          <ChevronDown size={16} style={{ color: "var(--ink-3)" }} />
        </button>
      </div>

      {/* Workspace name */}
      <div style={{ marginTop: 24 }}>
        <FieldLabel>Workspace name</FieldLabel>
        <FieldHelper>The name of your company or organization</FieldHelper>
        <input
          type="text"
          aria-label="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isOwner}
          style={{
            marginTop: 10,
            width: "100%",
            opacity: isOwner ? 1 : 0.6,
          }}
        />
      </div>

      {/* "All" persona */}
      <div style={{ marginTop: 24 }}>
        <FieldLabel>&quot;All&quot; persona</FieldLabel>
        <FieldHelper>
          Set the name and instructions for the general agent for all users in
          this workspace
        </FieldHelper>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)" }}>
            Name
          </div>
          <input
            type="text"
            aria-label="Persona name"
            value={personaName}
            onChange={(e) => setPersonaName(e.target.value)}
            disabled={!isOwner}
            style={{
              marginTop: 6,
              width: "100%",
              opacity: isOwner ? 1 : 0.6,
            }}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)" }}>
            Instructions
          </div>
          <textarea
            aria-label="Persona instructions"
            value={personaInstructions}
            onChange={(e) => setPersonaInstructions(e.target.value)}
            disabled={!isOwner}
            rows={4}
            placeholder={
              'Instructions, like "Answer all questions in Spanish", or "Always follow our tone of voice guideline"'
            }
            style={{
              marginTop: 6,
              width: "100%",
              fontSize: 13,
              color: "var(--ink)",
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 9,
              padding: "9px 12px",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.55,
              opacity: isOwner ? 1 : 0.6,
            }}
          />
        </div>
      </div>

      {/* Save */}
      <div style={{ marginTop: 24 }}>
        {!isOwner && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-3)",
              marginBottom: 10,
            }}
          >
            Only the workspace owner can change these settings.
          </div>
        )}
        <button
          type="button"
          disabled={!isOwner || saving}
          onClick={handleSave}
          style={{
            height: 36,
            padding: "0 18px",
            borderRadius: 10,
            border: "none",
            background: "var(--hover-soft)",
            color: "var(--ink-3)",
            fontSize: 13.5,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: isOwner && !saving ? "pointer" : "default",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function SortHeader({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={`Sort by ${label.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        color: "var(--ink-2)",
        fontWeight: 500,
        whiteSpace: "nowrap",
        border: "none",
        background: "transparent",
        padding: 0,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {label}
      <ChevronDown size={12} aria-hidden style={{ color: "var(--ink-3)" }} />
    </button>
  );
}

function MembersTab({
  isOwner,
  currentUserId,
  members,
  totalCount,
  query,
  setQuery,
  onRemoveMember,
}: {
  isOwner: boolean;
  currentUserId: string;
  members: WorkspaceMember[];
  totalCount: number;
  query: string;
  setQuery: (v: string) => void;
  onRemoveMember: (member: WorkspaceMember) => void | Promise<void>;
}) {
  return (
    <div style={{ marginTop: 28 }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <SectionLabel>Members settings</SectionLabel>
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {totalCount} {totalCount === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Search */}
      <div
        style={{
          position: "relative",
          marginTop: 14,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Search
          size={15}
          aria-hidden
          style={{
            position: "absolute",
            left: 11,
            color: "var(--ink-3)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          aria-label="Search members"
          placeholder="Search members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", paddingLeft: 33 }}
        />
      </div>

      {/* Table */}
      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table
          aria-label="Members"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th scope="col" style={{ textAlign: "left", padding: "0 12px 8px 0" }}>
                <SortHeader label="Name" />
              </th>
              <th scope="col" style={{ textAlign: "left", padding: "0 12px 8px" }}>
                <SortHeader label="Role" />
              </th>
              <th scope="col" style={{ textAlign: "left", padding: "0 12px 8px" }}>
                <SortHeader label="Status" />
              </th>
              <th scope="col" style={{ textAlign: "left", padding: "0 12px 8px" }}>
                <SortHeader label="Account created" />
              </th>
              <th scope="col" style={{ textAlign: "left", padding: "0 12px 8px" }}>
                <SortHeader label="Last active" />
              </th>
              {isOwner && (
                <th scope="col" aria-label="Actions" style={{ width: 40, padding: "0 0 8px" }} />
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isOwner={isOwner}
                isSelf={m.userId === currentUserId}
                onRemoveMember={onRemoveMember}
              />
            ))}
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={isOwner ? 6 : 5}
                  style={{
                    padding: "32px 0",
                    textAlign: "center",
                    color: "var(--ink-3)",
                    fontSize: 13,
                  }}
                >
                  No members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isOwner,
  isSelf,
  onRemoveMember,
}: {
  member: WorkspaceMember;
  isOwner: boolean;
  isSelf: boolean;
  onRemoveMember: (member: WorkspaceMember) => void | Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Owners may remove anyone except themselves.
  const canRemove = isOwner && !isSelf;

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  return (
    <tr style={{ borderBottom: "1px solid var(--line-soft)" }}>
      <td style={{ padding: "12px 12px 12px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "var(--green)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {(member.fullName || member.email || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                color: "var(--ink)",
                whiteSpace: "nowrap",
              }}
            >
              {member.fullName || "—"}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-3)",
                whiteSpace: "nowrap",
              }}
            >
              {member.email}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: "12px", color: "var(--ink-2)" }}>
        {member.role === "owner" ? "Owner" : "Member"}
      </td>
      <td style={{ padding: "12px", color: "var(--ink)" }}>Active</td>
      <td
        style={{
          padding: "12px",
          color: "var(--ink-2)",
          whiteSpace: "nowrap",
        }}
      >
        {formatJoinedDate(member.joinedAt)}
      </td>
      <td
        style={{
          padding: "12px",
          color: "var(--ink-2)",
          whiteSpace: "nowrap",
        }}
      >
        —
      </td>
      {isOwner && (
        <td style={{ padding: "12px 0", textAlign: "right" }}>
          {canRemove ? (
            <div
              ref={menuRef}
              style={{ position: "relative", display: "inline-block" }}
            >
              <button
                type="button"
                className="iconbtn"
                aria-label="Member actions"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    zIndex: 20,
                    minWidth: 180,
                    background: "var(--bg)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    padding: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void onRemoveMember(member);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 7,
                      border: "none",
                      background: "transparent",
                      color: "var(--red, #e5484d)",
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--hover-soft)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    Remove from workspace
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </td>
      )}
    </tr>
  );
}
