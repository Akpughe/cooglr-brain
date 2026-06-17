"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ThreadSummary } from "./types";

function relTime(iso: string | null): string {
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

/** ⌘K palette over recent chats — ported from recally SearchPalette. */
export function AgentSearchPalette({
  threads,
  onPick,
  onAsk,
  onClose,
}: {
  threads: ThreadSummary[];
  onPick: (id: string) => void;
  onAsk: (q: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(needle));
  }, [q, threads]);

  useEffect(() => setSel(0), [q]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap Tab focus within the dialog (wrap from last to first and back).
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (activeEl === first || !dialogRef.current.contains(activeEl)) {
            e.preventDefault();
            last.focus();
          }
        } else if (activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = () => {
    const m = matches[sel];
    if (m) onPick(m.id);
    else if (q.trim()) onAsk(q.trim());
  };

  return (
    <>
      <div className="palette-veil" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <input
          ref={inputRef}
          type="text"
          value={q}
          placeholder="Search chats"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="search-results-listbox"
          aria-activedescendant={matches[sel] ? `search-result-${sel}` : undefined}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, matches.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              pick();
            }
          }}
        />
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "4px 18px 6px" }}>
          {matches.length ? "Recent chats" : ""}
        </div>
        <div
          id="search-results-listbox"
          role="listbox"
          aria-label="Recent chats"
          style={{ maxHeight: 320, overflowY: "auto", padding: "0 8px 8px" }}
        >
          {matches.map((t, i) => (
            <button
              key={t.id}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === sel}
              className={`prow ${i === sel ? "sel" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={pick}
            >
              <span className="q">{t.title}</span>
              <span className="kbd">{i < 9 ? `⌘${i + 1}` : relTime(t.lastMessageAt)}</span>
            </button>
          ))}
          {!matches.length && (
            <div style={{ padding: "10px 12px 16px", fontSize: 13, color: "var(--ink-3)" }}>
              No chats match — press Enter to start a new chat
            </div>
          )}
        </div>
      </div>
    </>
  );
}
