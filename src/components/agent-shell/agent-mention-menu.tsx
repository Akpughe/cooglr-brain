"use client";

import {
  FileText,
  Sheet,
  Presentation,
  AppWindow,
  Palette,
  Package,
  Folder,
  type LucideIcon,
} from "lucide-react";

export type MentionItem = {
  id: string;
  group: "plugin" | "skill" | "file";
  label: string;
  sublabel?: string;
  iconKind: string;
};

type Props = {
  query: string;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  selectedIndex?: number;
  onHoverIndex?: (i: number) => void;
  /** Real file/page entries to show in the Files group. When omitted, no
   *  files are shown (the "Type to search for files" placeholder appears). */
  files?: MentionItem[];
};

/** Plugins + skills seed list, in display order. Files are supplied at runtime
 *  via the `files` prop / argument so they reflect real workspace content. */
export const MENTION_ITEMS: MentionItem[] = [
  // Plugins
  { id: "plugin-documents", group: "plugin", label: "Documents", sublabel: "Create and edit document artifacts", iconKind: "documents" },
  { id: "plugin-pdf", group: "plugin", label: "PDF", sublabel: "Read, create, and verify PDF files", iconKind: "pdf" },
  { id: "plugin-spreadsheets", group: "plugin", label: "Spreadsheets", sublabel: "Create and edit spreadsheet files", iconKind: "spreadsheets" },
  { id: "plugin-presentations", group: "plugin", label: "Presentations", sublabel: "Create and edit presentations", iconKind: "presentations" },
  { id: "plugin-browser", group: "plugin", label: "Browser", sublabel: "Control the in-app browser", iconKind: "browser" },
  { id: "plugin-canva", group: "plugin", label: "Canva", sublabel: "Search, create, edit designs", iconKind: "canva" },
  { id: "plugin-creative", group: "plugin", label: "Creative Production", sublabel: "Create marketing visuals from a brief", iconKind: "creative" },
  { id: "plugin-gmail", group: "plugin", label: "Gmail", sublabel: "Read and manage Gmail", iconKind: "gmail" },

  // Skills
  { id: "skill-gmail", group: "skill", label: "Gmail", sublabel: "Summarize threads and draft replies", iconKind: "skill" },
  { id: "skill-inbox-triage", group: "skill", label: "Inbox Triage", sublabel: "Triage an inbox into action buckets", iconKind: "skill" },
];

/**
 * Case-insensitive substring match on label, over plugins + skills + the
 * provided real files. Empty query returns the full list. The returned flat
 * order matches the order the menu renders rows in (plugin → skill → file),
 * which the composer relies on for keyboard navigation.
 */
export function filterMentions(query: string, files: MentionItem[] = []): MentionItem[] {
  const all = [...MENTION_ITEMS, ...files];
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((it) => it.label.toLowerCase().includes(q));
}

const GROUP_LABELS: Record<MentionItem["group"], string> = {
  plugin: "Plugins",
  skill: "Skills",
  file: "Files",
};

const GROUP_ORDER: MentionItem["group"][] = ["plugin", "skill", "file"];

/** Colored tile config for plugin icons. */
const PLUGIN_TILES: Record<string, { bg: string; icon?: LucideIcon; letter?: string }> = {
  documents: { bg: "#2563eb", icon: FileText },
  pdf: { bg: "#dc2626", icon: FileText },
  spreadsheets: { bg: "#16a34a", icon: Sheet },
  presentations: { bg: "#d97706", icon: Presentation },
  browser: { bg: "#64748b", icon: AppWindow },
  canva: { bg: "#14b8a6", letter: "C" },
  creative: { bg: "#9333ea", icon: Palette },
};

function PluginIcon({ iconKind }: { iconKind: string }) {
  if (iconKind === "gmail") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/connector-logos/gmail.svg" alt="" width={18} height={18} style={{ display: "block", flexShrink: 0 }} />
    );
  }
  const tile = PLUGIN_TILES[iconKind];
  if (!tile) return null;
  const Icon = tile.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 5,
        background: tile.bg,
        color: "#fff",
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {Icon ? <Icon size={11} strokeWidth={2.4} /> : tile.letter}
    </span>
  );
}

function ItemIcon({ item }: { item: MentionItem }) {
  if (item.group === "plugin") return <PluginIcon iconKind={item.iconKind} />;
  if (item.group === "skill") return <Package size={18} strokeWidth={1.9} color="var(--ink-2)" style={{ flexShrink: 0 }} />;
  return <Folder size={18} strokeWidth={1.9} color="var(--ink-3)" style={{ flexShrink: 0 }} />;
}

function Row({
  item,
  flatIndex,
  selectedIndex,
  onSelect,
  onHoverIndex,
}: {
  item: MentionItem;
  flatIndex: number;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onHoverIndex?: (i: number) => void;
}) {
  const selected = flatIndex === selectedIndex;
  return (
    <button
      type="button"
      role="option"
      id={`mention-opt-${flatIndex}`}
      aria-selected={selected}
      className={selected ? "prow sel" : "prow"}
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHoverIndex?.(flatIndex)}
    >
      <ItemIcon item={item} />
      <span
        className="q"
        style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", flexShrink: 0 }}>{item.label}</span>
        {item.sublabel ? (
          <span
            style={{
              fontSize: 13,
              color: "var(--ink-3)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {item.sublabel}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function AgentMentionMenu({
  query,
  onSelect,
  onClose: _onClose,
  selectedIndex = 0,
  onHoverIndex,
  files = [],
}: Props) {
  const filtered = filterMentions(query, files);
  const isEmptyQuery = query.trim().length === 0;

  // flat index assigned in display order (matches filterMentions order)
  let flat = -1;

  const sections = GROUP_ORDER.map((group) => {
    const items = filtered.filter((it) => it.group === group);
    return { group, items };
  }).filter((s) => {
    // Always keep Files section so the placeholder can render when query is empty.
    if (s.group === "file" && isEmptyQuery) return true;
    return s.items.length > 0;
  });

  if (sections.length === 0) {
    return (
      <div
        role="listbox"
        id="mention-listbox"
        style={{
          borderRadius: 14,
          background: "var(--bg)",
          border: "1px solid var(--line)",
          boxShadow: "0 0 0 1px rgba(0,0,0,.04), 0 16px 44px -12px rgba(0,0,0,.22)",
          overflow: "hidden",
          padding: 6,
        }}
      >
        <div style={{ padding: "10px 10px", fontSize: 13, color: "var(--ink-3)" }}>No matches</div>
      </div>
    );
  }

  return (
    <div
      role="listbox"
      id="mention-listbox"
      style={{
        borderRadius: 14,
        background: "var(--bg)",
        border: "1px solid var(--line)",
        boxShadow: "0 0 0 1px rgba(0,0,0,.04), 0 16px 44px -12px rgba(0,0,0,.22)",
        overflow: "hidden",
        maxHeight: 360,
        overflowY: "auto",
        padding: 6,
      }}
    >
      {sections.map(({ group, items }) => (
        <div key={group}>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-3)",
              fontWeight: 500,
              padding: "8px 10px 4px",
            }}
          >
            {GROUP_LABELS[group]}
          </div>
          {group === "file" && items.length === 0 && isEmptyQuery ? (
            <div className="prow" aria-disabled="true" style={{ color: "var(--ink-3)", cursor: "default" }}>
              <Folder size={18} strokeWidth={1.9} color="var(--ink-3)" style={{ flexShrink: 0 }} />
              <span className="q" style={{ color: "var(--ink-3)", fontSize: 14 }}>
                Type to search for files
              </span>
            </div>
          ) : (
            items.map((item) => {
              flat += 1;
              return (
                <Row
                  key={item.id}
                  item={item}
                  flatIndex={flat}
                  selectedIndex={selectedIndex}
                  onSelect={onSelect}
                  onHoverIndex={onHoverIndex}
                />
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

export default AgentMentionMenu;
