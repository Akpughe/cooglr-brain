"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, FileText, Image as ImageIcon, Layers, Mic, Plus, Square, X } from "lucide-react";
import { useWorkspace } from "@/lib/workspace/context";
import { MODEL_PROFILE_LABELS, type ModelProfile } from "./types";
import {
  AgentMentionMenu,
  filterMentions,
  providerLabel,
  type MentionItem,
} from "./agent-mention-menu";

/** Format an ISO timestamp as a short YYYY-MM-DD date for the mention sublabel. */
function formatFileDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Find an active "@token" ending at the caret (start-of-line or after whitespace). */
function detectMention(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(?:^|\s)@([^\s@]*)$/);
  if (!m) return null;
  return { start: caret - m[1].length - 1, query: m[1] };
}

/**
 * Split `text` into plain / mention segments by matching the exact `@label`
 * tokens that were inserted from the menu. Longest labels first so a label that
 * is a prefix of another doesn't win. Used by the highlight backdrop to paint
 * inserted mentions blue while leaving the rest of the text in the ink color.
 */
function segmentMentions(text: string, labels: string[]): { text: string; mention: boolean }[] {
  const uniq = [...new Set(labels)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (uniq.length === 0) return [{ text, mention: false }];
  const escaped = uniq.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(?:${escaped.join("|")})`, "g");
  const out: { text: string; mention: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), mention: false });
    out.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width loops
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}

interface Props {
  onSend: (text: string, focusFileIds?: string[]) => void;
  onStop: () => void;
  status: "ready" | "submitted" | "streaming" | "error";
  modelProfile: ModelProfile;
  onModelProfileChange: (p: ModelProfile) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

interface Attachment {
  id: string;
  file: File;
  url?: string; // object URL for image previews
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const isImage = att.file.type.startsWith("image/");
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 10px 6px 6px",
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "var(--bg)",
        maxWidth: 230,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {isImage && att.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={att.url} alt={att.file.name} style={{ width: 34, height: 34, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <span style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f4", color: "var(--ink-2)", flexShrink: 0 }}>
          {isImage ? <ImageIcon style={{ width: 16, height: 16 }} /> : <FileText style={{ width: 16, height: 16 }} />}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
          {att.file.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{formatSize(att.file.size)}</div>
      </div>
      <button
        type="button"
        aria-label="Remove attachment"
        onClick={onRemove}
        style={{
          position: "absolute",
          top: -7,
          right: -7,
          width: 18,
          height: 18,
          borderRadius: 999,
          border: "1.5px solid var(--bg)",
          background: "var(--ink)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <X aria-hidden="true" style={{ width: 10, height: 10 }} />
      </button>
    </div>
  );
}

/** Recally Composer + file attachments. The "+" opens the file picker; selected
 *  files appear as removable chips/thumbnails above the input. */
export function AgentComposer({
  onSend,
  onStop,
  status,
  modelProfile,
  onModelProfileChange,
  autoFocus,
  placeholder = "Ask your workspace anything",
}: Props) {
  const { workspace } = useWorkspace();
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Real workspace data for the @-mention menu (fetched once per workspace).
  const [fileMentions, setFileMentions] = useState<MentionItem[]>([]);
  const [integrationMentions, setIntegrationMentions] = useState<MentionItem[]>([]);
  // Exact "@label" tokens inserted from the menu, used to paint them blue.
  const [mentionLabels, setMentionLabels] = useState<string[]>([]);
  // Files the user @-referenced, used to hard-pin retrieval on send.
  const [focusFiles, setFocusFiles] = useState<{ id: string; label: string }[]>([]);
  const dataLoadedRef = useRef(false);
  useEffect(() => {
    // Re-fetch if the workspace changes so stale data doesn't linger.
    dataLoadedRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale menu data on workspace switch
    setFileMentions([]);
    setIntegrationMentions([]);
  }, [workspace.id]);

  // @-mention popup state.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const mentionRef = useRef<HTMLDivElement>(null);
  const mentionCount = mention
    ? filterMentions(mention.query, integrationMentions, fileMentions).length
    : 0;

  // Lazily load the workspace's connected apps + recent files the first time the
  // menu opens. Both are best-effort and degrade to empty on error.
  useEffect(() => {
    if (!mention || dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/files?workspaceId=${encodeURIComponent(workspace.id)}`);
        if (res.ok) {
          const data: { files?: Array<{ id: string; type: string; title: string; updatedAt?: string }> } =
            await res.json();
          const items: MentionItem[] = (data.files ?? [])
            .filter((f) => f.type !== "folder")
            .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
            .slice(0, 8)
            .map((f) => ({
              id: `file-${f.id}`,
              group: "file" as const,
              label: f.title || "Untitled",
              sublabel: formatFileDate(f.updatedAt),
              iconKind: "file",
            }));
          if (active) setFileMentions(items);
        }
      } catch {
        if (active) setFileMentions([]);
      }
      try {
        // Only offer integrations the user has actually connected (Composio),
        // so @gmail isn't suggested when Gmail isn't connected.
        const res = await fetch("/api/composio/connect");
        if (res.ok) {
          const data = (await res.json()) as { connected?: unknown };
          const slugs = Array.isArray(data.connected) ? data.connected.map((t) => String(t).toLowerCase()) : [];
          const seen = new Set<string>();
          const items: MentionItem[] = [];
          for (const slug of slugs) {
            const key = slug === "google-drive" ? "drive" : slug; // menu icon/label key
            if (seen.has(key)) continue; // one chip per integration
            seen.add(key);
            items.push({
              id: `integration-${key}`,
              group: "integration",
              label: providerLabel(key),
              iconKind: key,
            });
          }
          if (active) setIntegrationMentions(items);
        }
      } catch {
        if (active) setIntegrationMentions([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [mention, workspace.id]);

  function syncMention(text: string, caret: number) {
    const next = detectMention(text, caret);
    setMention(next);
    setMentionIdx(0);
  }

  function applyMention(item: MentionItem) {
    if (!mention) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const insert = `@${item.label} `;
    const next = value.slice(0, mention.start) + insert + value.slice(caret);
    setValue(next);
    setMention(null);
    setMentionLabels((prev) => (prev.includes(item.label) ? prev : [...prev, item.label]));
    if (item.group === "file") {
      const fileId = item.id.replace(/^file-/, "");
      setFocusFiles((prev) => (prev.some((f) => f.id === fileId) ? prev : [...prev, { id: fileId, label: item.label }]));
    }
    requestAnimationFrame(() => {
      const pos = mention.start + insert.length;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  const segments = segmentMentions(value, mentionLabels);

  const busy = status === "streaming" || status === "submitted";
  const ready = (value.trim().length > 0 || attachments.length > 0) && !busy;

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    // Keep the highlight backdrop the same height + scroll offset as the textarea.
    if (backdropRef.current) {
      backdropRef.current.style.height = el.style.height;
      backdropRef.current.scrollTop = el.scrollTop;
    }
  }, [value]);

  function syncBackdropScroll() {
    if (backdropRef.current && ref.current) {
      backdropRef.current.scrollTop = ref.current.scrollTop;
    }
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (mentionRef.current && !mentionRef.current.contains(t) && ref.current && !ref.current.contains(t)) {
        setMention(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Clean up object URLs.
  useEffect(() => () => attachments.forEach((a) => a.url && URL.revokeObjectURL(a.url)), [attachments]);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  }

  function submit() {
    if (!ready) return;
    // Only pin files whose @mention is still present in the text the user is sending.
    const active = focusFiles.filter((f) => value.includes(`@${f.label}`)).map((f) => f.id);
    onSend(value, active.length > 0 ? active : undefined);
    setValue("");
    setAttachments([]);
    setMentionLabels([]);
    setFocusFiles([]);
  }

  return (
    <div className="composer" style={{ position: "relative" }}>
      {mention && mentionCount > 0 && (
        <div
          ref={mentionRef}
          style={{ position: "absolute", left: 8, right: 8, bottom: "calc(100% + 8px)", maxWidth: 460, zIndex: 60 }}
        >
          <AgentMentionMenu
            query={mention.query}
            integrations={integrationMentions}
            files={fileMentions}
            selectedIndex={mentionIdx}
            onHoverIndex={setMentionIdx}
            onSelect={applyMention}
            onClose={() => setMention(null)}
          />
        </div>
      )}

      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 16px 2px" }}>
          {attachments.map((a) => (
            <AttachmentChip key={a.id} att={a} onRemove={() => removeAttachment(a.id)} />
          ))}
        </div>
      )}

      <div className="ta-wrap">
        {/* Highlight backdrop: mirrors the textarea text and paints inserted
            @mentions blue. The textarea sits on top with transparent text so the
            real caret + selection still work. */}
        <div className="ta-backdrop" aria-hidden="true" ref={backdropRef}>
          {segments.map((s, i) =>
            s.mention ? (
              <span key={i} className="mention">
                {s.text}
              </span>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
          {"​"}
        </div>
        <textarea
          ref={ref}
          className="ta-input"
          rows={1}
          value={value}
          placeholder={placeholder}
          {...(mention && mentionCount > 0
            ? {
                role: "combobox",
                "aria-expanded": true,
                "aria-controls": "mention-listbox",
                "aria-activedescendant": `mention-opt-${mentionIdx}`,
              }
            : {})}
          onScroll={syncBackdropScroll}
          onChange={(e) => {
          setValue(e.target.value);
          syncMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            const el = e.currentTarget;
            syncMention(el.value, el.selectionStart ?? el.value.length);
          }
        }}
        onClick={(e) => {
          const el = e.currentTarget;
          syncMention(el.value, el.selectionStart ?? el.value.length);
        }}
        onKeyDown={(e) => {
          if (mention && mentionCount > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMentionIdx((i) => (i + 1) % mentionCount);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setMentionIdx((i) => (i - 1 + mentionCount) % mentionCount);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              applyMention(filterMentions(mention.query, integrationMentions, fileMentions)[mentionIdx]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setMention(null);
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="c-row">
        {/* Add files */}
        <button
          type="button"
          className="iconbtn tip"
          data-tip="Add files"
          aria-label="Add files"
          onClick={() => fileRef.current?.click()}
        >
          <Plus aria-hidden="true" />
        </button>

        <span className="scope-chip">
          <Layers />
          All sources
        </span>
        <span style={{ flex: 1 }} />

        {/* model selector */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label="Model profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 13,
              color: "var(--ink-2)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              padding: "5px 6px",
              borderRadius: 8,
            }}
          >
            {MODEL_PROFILE_LABELS[modelProfile].label}
            <ChevronDown aria-hidden="true" style={{ width: 14, height: 14 }} />
          </button>
          {menuOpen && (
            <div
              role="listbox"
              aria-label="Model profile"
              className="card rise"
              style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: 232, padding: 4, boxShadow: "var(--shadow-pop)", zIndex: 50, overflow: "hidden" }}
            >
              {(Object.keys(MODEL_PROFILE_LABELS) as ModelProfile[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="option"
                  aria-selected={modelProfile === p}
                  onClick={() => { onModelProfileChange(p); setMenuOpen(false); }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: modelProfile === p ? "var(--hover-soft)" : "transparent",
                    borderRadius: 8,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={(e) => { if (modelProfile !== p) e.currentTarget.style.background = "var(--hover-soft)"; }}
                  onMouseLeave={(e) => { if (modelProfile !== p) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                    {MODEL_PROFILE_LABELS[p].label}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-2)" }}>
                    {MODEL_PROFILE_LABELS[p].hint}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* mic (no-op) */}
        <button className="iconbtn tip" data-tip="Dictate" aria-label="Dictate" type="button" tabIndex={-1}>
          <Mic aria-hidden="true" />
        </button>

        {/* send / stop */}
        {busy ? (
          <button className="send ready" type="button" onClick={onStop} aria-label="Stop">
            <Square aria-hidden="true" style={{ width: 11, height: 11, fill: "currentColor" }} />
          </button>
        ) : (
          <button className={`send ${ready ? "ready" : ""}`} type="button" onClick={submit} aria-label="Send">
            <ArrowUp aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
