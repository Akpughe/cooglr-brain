"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Plus,
  Search,
  ChevronDown,
  FileText,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace/context";

interface Folder {
  id: string;
  name: string;
  owner?: string;
}

interface AgentFolderDetailViewProps {
  folder: Folder;
  onRemove?: () => void;
  onBack?: () => void;
}

interface ContentItem {
  id: string;
  title: string;
  kind: string;
  date: string;
  accent: boolean;
  indexStatus: string | null; // "indexing" | "done" | null
}

// Shape returned by GET /api/files (camelCase, no content)
interface FileNode {
  id: string;
  parentId: string | null;
  type: "page" | "folder" | "file";
  title: string;
  icon: string | null;
  isPrivate: boolean;
  position: number;
  createdBy: string;
  updatedAt: string;
  indexStatus?: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function extOf(title: string): string {
  const dot = title.lastIndexOf(".");
  return dot > 0 ? title.slice(dot + 1).toLowerCase() : "";
}

function kindLabel(node: FileNode): string {
  if (node.type === "folder") return "Folder";
  if (node.type === "page") return "Page";
  const ext = extOf(node.title);
  return ext ? ext.toUpperCase() : "File";
}

function isPdfish(node: FileNode): boolean {
  return node.type === "file" && extOf(node.title) === "pdf";
}

function toContentItem(node: FileNode): ContentItem {
  return {
    id: node.id,
    title: node.title,
    kind: kindLabel(node),
    date: formatDate(node.updatedAt),
    accent: isPdfish(node),
    indexStatus: node.indexStatus ?? null,
  };
}

export function AgentFolderDetailView({
  folder,
  onRemove,
}: AgentFolderDetailViewProps) {
  const { workspace } = useWorkspace();

  const [search, setSearch] = useState("");
  const [removeHover, setRemoveHover] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // Files we just uploaded that haven't reported "done" yet (drives the spinner
  // immediately, before the server has even started extracting).
  const [pending, setPending] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ownerInitial = (folder.owner ?? "D").trim().charAt(0).toUpperCase() || "D";

  const loadItems = useCallback(async () => {
    try {
      const r = await fetch(`/api/files?workspaceId=${workspace.id}&parentId=${folder.id}`);
      if (!r.ok) throw new Error("Failed to load content");
      const data: { files: FileNode[] } = await r.json();
      setItems((data.files || []).map(toContentItem));
    } catch {
      setItems([]);
    }
  }, [workspace.id, folder.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadItems().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadItems]);

  // Drop any pending file from the spinner set once it reaches a terminal state.
  useEffect(() => {
    if (pending.size === 0) return;
    const terminal = new Set(
      items.filter((it) => it.indexStatus === "done" || it.indexStatus === "error").map((it) => it.id),
    );
    if ([...pending].some((id) => terminal.has(id))) {
      setPending((prev) => new Set([...prev].filter((id) => !terminal.has(id))));
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while anything is still indexing so the status resolves on its own.
  const anyIndexing = pending.size > 0 || items.some((it) => it.indexStatus === "indexing");
  useEffect(() => {
    if (!anyIndexing) return;
    const t = setInterval(() => void loadItems(), 3000);
    return () => clearInterval(t);
  }, [anyIndexing, loadItems]);

  async function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;
    setUploading(true);
    let ok = 0;
    const newIds: string[] = [];
    for (const file of Array.from(picked)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("workspaceId", workspace.id);
        fd.append("parentId", folder.id);
        const res = await fetch("/api/files/upload", { method: "POST", body: fd });
        if (res.ok) {
          ok += 1;
          const j = await res.json().catch(() => null);
          if (j?.file?.id) newIds.push(j.file.id as string);
        } else {
          toast.error(`Couldn't upload ${file.name}`);
        }
      } catch {
        toast.error(`Couldn't upload ${file.name}`);
      }
    }
    e.target.value = "";
    if (newIds.length) setPending((prev) => new Set([...prev, ...newIds]));
    await loadItems();
    setUploading(false);
    if (ok > 0) toast(`Added ${ok} ${ok === 1 ? "file" : "files"} — indexing into memory…`);
  }

  const filteredItems = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return it.title.toLowerCase().includes(q) || it.kind.toLowerCase().includes(q);
  });

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div
        className="pane"
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "8px 40px 60px",
        }}
      >
        {/* ————— 1. Top action bar ————— */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 36,
          }}
        >
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onRemove}
            onMouseEnter={() => setRemoveHover(true)}
            onMouseLeave={() => setRemoveHover(false)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13.5,
              padding: "0 6px",
              height: 36,
              color: removeHover ? "var(--red)" : "var(--ink-2)",
              transition: "color 0.12s ease",
            }}
          >
            Remove
          </button>
          <button type="button" className="btn btn-outline">
            Share
          </button>
          <button type="button" className="iconbtn" aria-label="More">
            <MoreHorizontal size={16} aria-hidden />
          </button>
          <button type="button" className="btn btn-outline">
            Help
          </button>
        </div>

        {/* ————— 2. People row ————— */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "var(--ink)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {ownerInitial}
          </div>
          <button
            type="button"
            aria-label="Add people"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "1px dashed var(--line)",
              background: "transparent",
              color: "var(--ink-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Plus size={14} aria-hidden />
          </button>
        </div>

        {/* ————— 3. Title row ————— */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            {folder.name}
          </h1>
          <button type="button" className="iconbtn" aria-label="Folder options">
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </div>

        {/* ————— 4. Description ————— */}
        <button
          type="button"
          style={{
            display: "block",
            marginTop: 6,
            border: "none",
            background: "transparent",
            color: "var(--ink-3)",
            fontSize: 15,
            cursor: "text",
            padding: 0,
            textAlign: "left",
          }}
        >
          Add a description…
        </button>

        {/* ————— Content header + Add content ————— */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 26,
          }}
        >
          <span
            style={{
              height: 34,
              padding: "0 16px",
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              background: "var(--ink)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            Content
          </span>

          <div style={{ flex: 1 }} />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={onFilesPicked}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} aria-hidden />
            {uploading ? "Adding…" : "Add content"}
          </button>
        </div>

        {/* ————— 7. Search + sort ————— */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={15}
              aria-hidden
              style={{
                position: "absolute",
                left: 11,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-3)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              aria-label="Search content"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content"
              style={{ width: "100%", maxWidth: "none", paddingLeft: 34 }}
            />
          </div>
          <button
            type="button"
            aria-label="Sort by relevance"
            aria-haspopup="listbox"
            aria-expanded={false}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              border: "none",
              background: "transparent",
              color: "var(--ink-2)",
              fontSize: 13.5,
              cursor: "pointer",
              padding: "0 4px",
              flexShrink: 0,
            }}
          >
            Relevance
            <ChevronDown size={15} aria-hidden />
          </button>
        </div>

        {/* ————— Content list ————— */}
        <div style={{ marginTop: 8 }}>
          {loading ? (
            <div style={{ padding: "18px 10px", fontSize: 13.5, color: "var(--ink-3)" }}>
              Loading content…
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: "18px 10px", fontSize: 13.5, color: "var(--ink-3)" }}>
              {search.trim() ? `No content matches “${search}”.` : "No content yet"}
            </div>
          ) : (
            filteredItems.map((item, i) => (
              <ContentRow
                key={item.id}
                item={item}
                pending={pending.has(item.id)}
                last={i === filteredItems.length - 1}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function IndexStatus({ status, pending }: { status: string | null; pending: boolean }) {
  const indexing = (pending || status === "indexing") && status !== "error";
  const indexed = status === "done";
  if (status === "error") {
    return (
      <span
        title="Couldn't read this file — it wasn't added to memory. (PDF/Office extraction failed.)"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--red)", flexShrink: 0 }}
      >
        <AlertCircle size={14} aria-hidden />
        Not indexed
      </span>
    );
  }
  if (indexed) {
    return (
      <span
        title="Indexed into memory — searchable by the agent"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--green)", flexShrink: 0 }}
      >
        <Check size={14} aria-hidden />
      </span>
    );
  }
  if (indexing) {
    return (
      <span
        title="Indexing into memory… the agent will be able to use this shortly"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}
        aria-label="Indexing into memory"
      >
        <Loader2 size={14} className="rc-spin" aria-hidden />
        Indexing…
      </span>
    );
  }
  return null;
}

function ContentRow({ item, pending, last }: { item: ContentItem; pending: boolean; last: boolean }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 64,
        padding: "0 10px",
        borderRadius: 10,
        cursor: "pointer",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        background: hover ? "var(--hover-soft)" : "transparent",
        transition: "background 0.12s ease",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: item.accent ? "rgba(220,38,38,.1)" : "var(--hover-soft)",
          color: item.accent ? "#dc2626" : "var(--ink-2)",
        }}
      >
        <FileText size={19} aria-hidden />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
          {item.kind} · {item.date}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <IndexStatus status={item.indexStatus} pending={pending} />
    </div>
  );
}
