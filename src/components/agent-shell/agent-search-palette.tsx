"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, MessageSquare } from "lucide-react";
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

type DocHit = { id: string; title: string };

type Row =
  | { type: "chat"; id: string; title: string; lastMessageAt: string | null }
  | { type: "doc"; id: string; title: string };

/** ⌘K palette over recent chats AND workspace documents. */
export function AgentSearchPalette({
  threads,
  workspaceId,
  onPick,
  onAsk,
  onOpenFile,
  onClose,
}: {
  threads: ThreadSummary[];
  workspaceId: string;
  onPick: (id: string) => void;
  onAsk: (q: string) => void;
  onOpenFile: (id: string, title: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [docs, setDocs] = useState<DocHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load the workspace's files once, when the palette opens.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/files?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!res.ok) return;
        const data: { files?: Array<{ id: string; type: string; title: string }> } = await res.json();
        const items = (data.files ?? [])
          .filter((f) => f.type !== "folder")
          .map((f) => ({ id: f.id, title: f.title || "Untitled" }));
        if (active) setDocs(items);
      } catch {
        /* degrade to chats-only */
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const { chatRows, docRows } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const chatRows: Row[] = threads
      .filter((t) => !needle || t.title.toLowerCase().includes(needle))
      .map((t) => ({ type: "chat", id: t.id, title: t.title, lastMessageAt: t.lastMessageAt }));
    const docRows: Row[] = docs
      .filter((d) => !needle || d.title.toLowerCase().includes(needle))
      .map((d) => ({ type: "doc", id: d.id, title: d.title }));
    return { chatRows, docRows };
  }, [q, threads, docs]);

  // Flat, keyboard-navigable order: chats first, then documents.
  const rows = useMemo(() => [...chatRows, ...docRows], [chatRows, docRows]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection when the query changes
  useEffect(() => setSel(0), [q]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
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

  const activate = (row: Row | undefined) => {
    if (!row) {
      if (q.trim()) onAsk(q.trim());
      return;
    }
    if (row.type === "chat") onPick(row.id);
    else onOpenFile(row.id, row.title);
  };

  return (
    <>
      <div className="palette-veil" aria-hidden="true" onClick={onClose} />
      <div ref={dialogRef} className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <input
          ref={inputRef}
          type="text"
          value={q}
          placeholder="Search chats and documents"
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls="search-results-listbox"
          aria-activedescendant={rows[sel] ? `search-result-${sel}` : undefined}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, rows.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              activate(rows[sel]);
            }
          }}
        />

        <div id="search-results-listbox" role="listbox" aria-label="Search results" style={{ maxHeight: 360, overflowY: "auto", padding: "0 8px 8px" }}>
          {chatRows.length > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "4px 10px 6px" }}>Chats</div>
          )}
          {chatRows.map((t, j) => {
            const i = j;
            return (
              <button
                key={`chat-${t.id}`}
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === sel}
                className={`prow ${i === sel ? "sel" : ""}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => activate(t)}
              >
                <MessageSquare size={16} strokeWidth={1.9} color="var(--ink-3)" style={{ flexShrink: 0 }} />
                <span className="q">{t.title}</span>
                <span className="kbd">{i < 9 ? `⌘${i + 1}` : relTime(t.type === "chat" ? t.lastMessageAt : null)}</span>
              </button>
            );
          })}

          {docRows.length > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "8px 10px 6px" }}>Documents</div>
          )}
          {docRows.map((d, j) => {
            const i = chatRows.length + j;
            return (
              <button
                key={`doc-${d.id}`}
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === sel}
                className={`prow ${i === sel ? "sel" : ""}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => activate(d)}
              >
                <FileText size={16} strokeWidth={1.9} color="var(--ink-3)" style={{ flexShrink: 0 }} />
                <span className="q">{d.title}</span>
              </button>
            );
          })}

          {rows.length === 0 && (
            <div style={{ padding: "10px 12px 16px", fontSize: 13, color: "var(--ink-3)" }}>
              No chats or documents match — press Enter to start a new chat
            </div>
          )}
        </div>
      </div>
    </>
  );
}
