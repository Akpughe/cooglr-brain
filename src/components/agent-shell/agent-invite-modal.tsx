"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace/context";

type RoleId = "owner" | "editor" | "viewer";

const ROLES: { id: RoleId; label: string; description: string }[] = [
  {
    id: "owner",
    label: "Owner",
    description: "Full control over all content, members, and settings",
  },
  {
    id: "editor",
    label: "Editor",
    description: "Can create, edit, and share content",
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "Can view and chat with content but not edit",
  },
];

export function AgentInviteModal({ onClose }: { onClose: () => void }) {
  const { workspace } = useWorkspace();
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [role, setRole] = useState<RoleId>("viewer");
  const [roleOpen, setRoleOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLTextAreaElement>(null);

  // Move focus into the dialog on open.
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Simple focus trap: keep Tab focus within the dialog.
  function handleTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !root.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const hasEmail = email.trim().length > 0;
  const selectedRole = ROLES.find((r) => r.id === role) ?? ROLES[2];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function handleSend() {
    if (!hasEmail || sending) return;

    const emails = Array.from(
      new Set(
        email
          .split(/[\s,]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes("@"))
      )
    );

    if (emails.length === 0) return;

    setSending(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      if (res.ok) {
        toast(`Invitation${emails.length > 1 ? "s" : ""} sent`);
        onClose();
        return;
      }

      const { error } = await res.json().catch(() => ({ error: null }));
      toast.error(error || "Couldn't send invites");
    } catch {
      toast.error("Couldn't send invites");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="palette-veil" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className="rc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        onKeyDown={handleTrap}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          background: "var(--bg)",
          borderRadius: 16,
          boxShadow:
            "0 0 0 1px rgba(0,0,0,.06), 0 28px 80px -14px rgba(0,0,0,.32)",
          padding: 22,
          zIndex: 60,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            id="invite-modal-title"
            style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}
          >
            Invite to your workspace
          </div>
          <button
            type="button"
            className="iconbtn"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Email */}
        <label
          htmlFor="invite-email"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            marginTop: 16,
          }}
        >
          Email
        </label>
        <textarea
          id="invite-email"
          ref={emailRef}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com, email-2@example.com"
          style={{
            marginTop: 8,
            width: "100%",
            minHeight: 150,
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 12,
            font: "inherit",
            fontSize: 13.5,
            color: "var(--ink)",
            background: "var(--bg)",
            outline: "none",
            resize: "vertical",
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
        />

        {/* Role */}
        <div
          id="invite-role-label"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            marginTop: 16,
          }}
        >
          Role
        </div>
        <div ref={roleRef} style={{ position: "relative", marginTop: 8 }}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={roleOpen}
            aria-labelledby="invite-role-label"
            onClick={() => setRoleOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              height: 44,
              padding: "0 12px",
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "var(--bg)",
              color: "var(--ink)",
              fontSize: 13.5,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <span>{selectedRole.label}</span>
            <ChevronDown size={16} aria-hidden style={{ color: "var(--ink-3)" }} />
          </button>
          {roleOpen && (
            <div
              className="card"
              role="listbox"
              aria-label="Role"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                width: "100%",
                background: "var(--bg)",
                borderRadius: 12,
                boxShadow:
                  "0 0 0 1px rgba(0,0,0,.06), 0 16px 44px -10px rgba(0,0,0,.22)",
                padding: 6,
                zIndex: 70,
              }}
            >
              {ROLES.map((r) => {
                const selected = r.id === role;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setRole(r.id);
                      setRoleOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "var(--ink)",
                      fontFamily: "inherit",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--hover-soft)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                        }}
                      >
                        {r.label}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 12.5,
                          color: "var(--ink-3)",
                          marginTop: 1,
                        }}
                      >
                        {r.description}
                      </span>
                    </span>
                    {selected && (
                      <Check
                        size={16}
                        aria-hidden
                        style={{ color: "var(--ink)", flexShrink: 0, marginTop: 1 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Group */}
        <label
          htmlFor="invite-group"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            marginTop: 16,
          }}
        >
          Group
        </label>
        <div
          style={{
            position: "relative",
            marginTop: 8,
            display: "flex",
            alignItems: "center",
          }}
        >
          <UserPlus
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
            id="invite-group"
            type="text"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Add user group (optional)"
            style={{ width: "100%", paddingLeft: 33 }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              color: "var(--ink-2)",
              fontSize: 13.5,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Go to member settings
          </button>
          {hasEmail ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              disabled
              style={{
                background: "var(--hover-soft)",
                color: "var(--ink-3)",
                border: "none",
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </>
  );
}
