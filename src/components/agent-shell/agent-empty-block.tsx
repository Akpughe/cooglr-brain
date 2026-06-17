"use client";

import type { LucideIcon } from "lucide-react";

/**
 * Centered empty-state block used across the panel surfaces (Folders grid,
 * folder contents, etc.). Icon in a soft tile, a title, a one-line hint, and an
 * optional primary action. Styled with the shell ink/line tokens so it matches
 * the surrounding panels rather than the chat surface's agent-* Tailwind vars.
 */
export function AgentEmptyBlock({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tighter vertical rhythm for inline (in-section) empty states. */
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 4,
        padding: compact ? "32px 20px" : "56px 20px",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 46,
          height: 46,
          borderRadius: 14,
          background: "var(--hover-soft)",
          color: "var(--ink-3)",
          marginBottom: 8,
        }}
      >
        <Icon size={20} strokeWidth={1.9} aria-hidden />
      </span>
      <div style={{ fontSize: 15, fontWeight: 650, color: "var(--ink)", letterSpacing: "-0.01em" }}>
        {title}
      </div>
      {hint ? (
        <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.5, maxWidth: 340 }}>
          {hint}
        </div>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={onAction}
          style={{ marginTop: 12 }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export default AgentEmptyBlock;
