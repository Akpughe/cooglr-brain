"use client";

import { FileText, Layers, Plug, type LucideIcon } from "lucide-react";

export type MentionGroup = "capability" | "integration" | "file";

export type MentionItem = {
  id: string;
  group: MentionGroup;
  label: string;
  sublabel?: string;
  /** For integrations this is the provider key (gmail, github, …); otherwise a kind hint. */
  iconKind: string;
};

type Props = {
  query: string;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  selectedIndex?: number;
  onHoverIndex?: (i: number) => void;
  /** Connected integrations for this workspace, supplied at runtime. */
  integrations?: MentionItem[];
  /** Real file/page entries, supplied at runtime so they reflect workspace content. */
  files?: MentionItem[];
};

/**
 * Always-available capabilities. These map to things the agent can actually do
 * today (workspace knowledge retrieval). No aspirational/unbuilt entries.
 */
export const CAPABILITY_ITEMS: MentionItem[] = [
  {
    id: "cap-knowledge",
    group: "capability",
    label: "All sources",
    sublabel: "Search every connected source and file",
    iconKind: "knowledge",
  },
];

/** Provider key → connector logo filename (in /public/connector-logos). */
const PROVIDER_LOGOS: Record<string, string> = {
  gmail: "gmail",
  google_mail: "gmail",
  github: "github",
  slack: "slack",
  drive: "drive",
  google_drive: "drive",
  googledrive: "drive",
  notion: "notion",
  google_meet: "google-meet",
  teams: "teams",
  microsoft_teams: "teams",
};

/** Provider key → display label. Falls back to a title-cased provider id. */
const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  google_mail: "Gmail",
  github: "GitHub",
  slack: "Slack",
  drive: "Google Drive",
  google_drive: "Google Drive",
  googledrive: "Google Drive",
  notion: "Notion",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  microsoft_teams: "Microsoft Teams",
};

export function providerLabel(provider: string): string {
  const key = provider.toLowerCase();
  return PROVIDER_LABELS[key] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function providerLogo(provider: string): string | null {
  const key = provider.toLowerCase();
  return PROVIDER_LOGOS[key] ?? null;
}

/**
 * Case-insensitive substring match on label, over capabilities + connected
 * integrations + the provided real files. Empty query returns the full list.
 * The flat order matches the render order (capability → integration → file),
 * which the composer relies on for keyboard navigation.
 */
export function filterMentions(
  query: string,
  integrations: MentionItem[] = [],
  files: MentionItem[] = [],
): MentionItem[] {
  const all = [...CAPABILITY_ITEMS, ...integrations, ...files];
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((it) => it.label.toLowerCase().includes(q));
}

const GROUP_LABELS: Record<MentionGroup, string> = {
  capability: "Capabilities",
  integration: "Connected apps",
  file: "Files",
};

const GROUP_ORDER: MentionGroup[] = ["capability", "integration", "file"];

const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  knowledge: Layers,
};

function ItemIcon({ item }: { item: MentionItem }) {
  if (item.group === "integration") {
    const logo = providerLogo(item.iconKind);
    if (logo) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/connector-logos/${logo}.svg`}
          alt=""
          width={18}
          height={18}
          style={{ display: "block", flexShrink: 0 }}
        />
      );
    }
    return <Plug size={17} strokeWidth={1.9} color="var(--ink-2)" style={{ flexShrink: 0 }} />;
  }
  if (item.group === "capability") {
    const Icon = CAPABILITY_ICONS[item.iconKind] ?? Layers;
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: 5,
          background: "var(--blue)",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <Icon size={11} strokeWidth={2.4} aria-hidden />
      </span>
    );
  }
  // file
  const ext = item.label.includes(".") ? item.label.slice(item.label.lastIndexOf(".") + 1).toLowerCase() : "";
  const isPdf = ext === "pdf";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        flexShrink: 0,
        color: isPdf ? "#dc2626" : "var(--ink-3)",
      }}
    >
      <FileText size={17} strokeWidth={1.9} aria-hidden />
    </span>
  );
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
      <span className="q" style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
          {item.label}
        </span>
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
  selectedIndex = 0,
  onHoverIndex,
  integrations = [],
  files = [],
}: Props) {
  const filtered = filterMentions(query, integrations, files);
  const isEmptyQuery = query.trim().length === 0;
  const noIntegrations = integrations.length === 0;

  // flat index assigned in display order (matches filterMentions order)
  let flat = -1;

  const sections = GROUP_ORDER.map((group) => ({
    group,
    items: filtered.filter((it) => it.group === group),
  })).filter((s) => {
    // Keep the Files + Connected sections on an empty query so their
    // placeholders can render even when there's nothing to show yet.
    if (isEmptyQuery && (s.group === "file" || s.group === "integration")) return true;
    return s.items.length > 0;
  });

  const shell: React.CSSProperties = {
    borderRadius: 14,
    background: "var(--bg)",
    border: "1px solid var(--line)",
    boxShadow: "0 0 0 1px rgba(0,0,0,.04), 0 16px 44px -12px rgba(0,0,0,.22)",
    overflow: "hidden",
    maxHeight: 360,
    overflowY: "auto",
    padding: 6,
  };

  if (sections.length === 0) {
    return (
      <div role="listbox" id="mention-listbox" style={{ ...shell, maxHeight: undefined }}>
        <div style={{ padding: "10px 10px", fontSize: 13, color: "var(--ink-3)" }}>No matches</div>
      </div>
    );
  }

  return (
    <div role="listbox" id="mention-listbox" style={shell}>
      {sections.map(({ group, items }) => (
        <div key={group}>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-3)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "9px 10px 4px",
            }}
          >
            {GROUP_LABELS[group]}
          </div>

          {group === "integration" && items.length === 0 && isEmptyQuery ? (
            <div className="prow" aria-disabled="true" style={{ cursor: "default" }}>
              <Plug size={17} strokeWidth={1.9} color="var(--ink-3)" style={{ flexShrink: 0 }} />
              <span className="q" style={{ color: "var(--ink-3)", fontSize: 13.5 }}>
                No apps connected yet — add them in Settings
              </span>
            </div>
          ) : group === "file" && items.length === 0 && isEmptyQuery ? (
            <div className="prow" aria-disabled="true" style={{ cursor: "default" }}>
              <FileText size={17} strokeWidth={1.9} color="var(--ink-3)" style={{ flexShrink: 0 }} />
              <span className="q" style={{ color: "var(--ink-3)", fontSize: 13.5 }}>
                {noIntegrations ? "Upload files in Folders to reference them" : "Type to search your files"}
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
