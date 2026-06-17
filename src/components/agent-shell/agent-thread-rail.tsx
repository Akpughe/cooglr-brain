"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SquarePen,
  Search,
  Blocks,
  FolderClosed,
  PanelLeft,
  PanelLeftClose,
  Settings as SettingsIcon,
  LogOut,
  User,
  Building2,
  ChevronsUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace/context";
import type { ThreadSummary } from "./types";

export type RailView = "new" | "search" | "plugins" | "folders" | "automations" | "settings" | "profile";

export interface RailProject {
  id: string;
  name: string;
  chats: { id: string; title: string; shortcut?: string }[];
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

interface Props {
  workspaceName: string;
  threads: ThreadSummary[];
  activeThreadId?: string;
  onNewChat: () => void;
  onSelectThread: (id: string) => void;
  navView?: RailView;
  onNav?: (v: RailView) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onDeleteThread?: (id: string) => void;
}

export function AgentThreadRail({
  workspaceName,
  threads,
  activeThreadId,
  onNewChat,
  onSelectThread,
  navView,
  onNav,
  collapsed = false,
  onToggleCollapse,
  onDeleteThread,
}: Props) {
  const router = useRouter();
  const { workspace, members, currentUserId } = useWorkspace();
  const me = members.find((m) => m.userId === currentUserId);
  const initial = me?.fullName?.[0]?.toUpperCase() || me?.email?.[0]?.toUpperCase() || "?";

  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest?.("[data-account]")) setAccountOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/login");
  }

  const goSettings = () => { setAccountOpen(false); if (onNav) onNav("settings"); else router.push(`/${workspace.slug}/settings`); };
  const goProfile = () => { setAccountOpen(false); if (onNav) onNav("profile"); else router.push(`/${workspace.slug}/settings`); };

  function avatarEl(size: number) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: "var(--ink)",
          color: "#fff",
          fontSize: size <= 28 ? 11 : 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {initial}
      </span>
    );
  }

  function accountMenu(pos: React.CSSProperties) {
    if (!accountOpen) return null;
    return (
      <div
        className="card rise"
        style={{ position: "absolute", padding: 4, boxShadow: "var(--shadow-pop)", zIndex: 50, overflow: "hidden", ...pos }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 10px", borderBottom: "1px solid var(--line)" }}>
          {avatarEl(28)}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {me?.fullName || me?.email || "Account"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {workspaceName} · {me?.role ?? "member"}
            </div>
          </div>
        </div>
        <MenuRow icon={<Building2 style={{ width: 16, height: 16 }} />} label="Switch workspace" onClick={() => { setAccountOpen(false); router.push("/"); }} />
        <MenuRow icon={<User style={{ width: 16, height: 16 }} />} label="Profile" onClick={goProfile} />
        <MenuRow icon={<SettingsIcon style={{ width: 16, height: 16 }} />} label="Settings" trailing="⌘," onClick={goSettings} />
        <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />
        <MenuRow icon={<LogOut style={{ width: 16, height: 16 }} />} label={signingOut ? "Signing out…" : "Log out"} onClick={signOut} />
      </div>
    );
  }

  const newActive = navView === "new" && !activeThreadId;

  // Two crossfading layers inside a width-animated shell: the expanded rail and a
  // narrow icon-only rail. Collapsing glides the width while the layers fade.
  return (
    <aside className={`rail ${collapsed ? "collapsed" : ""}`} style={{ width: collapsed ? 56 : 264 }}>
      {/* expanded layer */}
      <div className="rail-pane" style={{ width: 264, paddingTop: 12, opacity: collapsed ? 0 : 1, pointerEvents: collapsed ? "none" : "auto" }}>
        <div className="rail-head">
          <span className="rail-title">{workspaceName}</span>
          <button className="iconbtn" title="Collapse sidebar" onClick={onToggleCollapse} aria-label="Collapse sidebar" style={{ flexShrink: 0 }}>
            <PanelLeftClose style={{ width: 17, height: 17 }} />
          </button>
        </div>

        <nav style={{ padding: "2px 8px" }}>
          <button className={`nav-item ${newActive ? "active" : ""}`} onClick={onNewChat}>
            <SquarePen className="lucide" />
            New chat
          </button>
          <button className="nav-item" onClick={() => onNav?.("search")}>
            <Search className="lucide" />
            Search
          </button>
          <button className={`nav-item ${navView === "plugins" ? "active" : ""}`} onClick={() => onNav?.("plugins")}>
            <Blocks className="lucide" />
            Plugins
          </button>
          <button className={`nav-item ${navView === "folders" ? "active" : ""}`} onClick={() => onNav?.("folders")}>
            <FolderClosed className="lucide" />
            Folders
          </button>
        </nav>

        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 8px 8px" }}>
          {threads.length > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "18px 18px 6px" }}>Chats</div>
          )}
          {threads.map((t, i) => (
            <button
              key={t.id}
              className={`recent-item ${t.id === activeThreadId ? "active" : ""}`}
              onClick={() => onSelectThread(t.id)}
            >
              <span className="q">{t.title}</span>
              <span className="t">{i < 9 ? `⌘${i + 1}` : relativeTime(t.lastMessageAt)}</span>
              <span
                className="x"
                role="button"
                aria-label="Delete chat"
                onClick={(e) => { e.stopPropagation(); onDeleteThread?.(t.id); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        <div style={{ padding: 8 }} data-account>
          <div style={{ position: "relative" }}>
            {!collapsed && accountMenu({ bottom: "calc(100% + 6px)", left: 0, right: 0 })}
            <button
              className={`nav-item ${accountOpen ? "active" : ""}`}
              onClick={() => setAccountOpen((v) => !v)}
              style={{ justifyContent: "space-between" }}
              title="Settings & account"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <SettingsIcon className="lucide" />
                Settings
              </span>
              <ChevronsUpDown className="lucide" style={{ width: 15, height: 15, color: "var(--ink-3)" }} />
            </button>
          </div>
        </div>
      </div>

      {/* collapsed (icon-only) layer */}
      <div className="rail-pane rail-mini" style={{ width: 56, opacity: collapsed ? 1 : 0, pointerEvents: collapsed ? "auto" : "none" }}>
        <button className="rail-icon" title="Expand sidebar" onClick={onToggleCollapse} aria-label="Expand sidebar">
          <PanelLeft style={{ width: 18, height: 18 }} />
        </button>
        <div style={{ height: 6 }} />
        <button className={`rail-icon ${newActive ? "active" : ""}`} onClick={onNewChat} title="New chat" aria-label="New chat">
          <SquarePen style={{ width: 18, height: 18 }} />
        </button>
        <button className="rail-icon" onClick={() => onNav?.("search")} title="Search" aria-label="Search">
          <Search style={{ width: 18, height: 18 }} />
        </button>
        <button className={`rail-icon ${navView === "plugins" ? "active" : ""}`} onClick={() => onNav?.("plugins")} title="Plugins" aria-label="Plugins">
          <Blocks style={{ width: 18, height: 18 }} />
        </button>
        <button className={`rail-icon ${navView === "folders" ? "active" : ""}`} onClick={() => onNav?.("folders")} title="Folders" aria-label="Folders">
          <FolderClosed style={{ width: 18, height: 18 }} />
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ position: "relative", paddingBottom: 10 }} data-account>
          {collapsed && accountMenu({ bottom: 8, left: "calc(100% + 8px)", width: 232 })}
          <button className="rail-icon" onClick={() => setAccountOpen((v) => !v)} title="Account" aria-label="Account">
            {avatarEl(26)}
          </button>
        </div>
      </div>
    </aside>
  );
}

function MenuRow({
  icon,
  label,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px",
        border: "none",
        background: "transparent",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        textAlign: "left",
        color: "var(--ink)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: "var(--ink-3)", display: "flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {trailing && <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{trailing}</span>}
    </button>
  );
}
