"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Upload,
  FolderClosed,
  Folder as FolderIcon,
  MoreHorizontal,
  Search,
  X,
  FileText,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace/context";
import {
  useFiles,
  useCreateFolder,
  useDeleteFile,
  invalidateFiles,
  type FileNode,
} from "@/lib/queries";
import { SkeletonCard, SkeletonRow } from "@/components/agent-shell/skeleton";
import { AgentEmptyBlock } from "@/components/agent-shell/agent-empty-block";

interface Folder {
  id: string;
  name: string;
  owner: string;
}

type BrowseEntry =
  | { kind: "folder"; id: string; folder: Folder }
  | { kind: "file"; id: string; file: FileNode; owner: string };

interface UploadedFile {
  id: string;
  name: string;
  file?: File;
}

type Visibility = "invite" | "all";

let idSeq = 0;
const nextId = () => `id-${++idSeq}-${Date.now()}`;

export function AgentFoldersView({
  onOpenFolder,
  onOpenFile,
}: {
  onOpenFolder?: (folder: Folder) => void;
  onOpenFile?: (fileId: string, title: string) => void;
} = {}) {
  const { workspace, members } = useWorkspace();
  const qc = useQueryClient();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const rootFileInputRef = useRef<HTMLInputElement>(null);

  const resolveOwner = (createdBy: string) =>
    members.find((m) => m.userId === createdBy)?.fullName ?? "—";

  // All root-level nodes — folders AND loose uploaded files. Loose files were
  // previously filtered out entirely, which made uploads to the workspace root
  // invisible. We now surface them in the Browse-all list.
  const { data: rootNodes, isLoading } = useFiles(workspace.id, null);
  const createFolder = useCreateFolder(workspace.id);
  const deleteFile = useDeleteFile(workspace.id, null);

  const folderNodes = (rootNodes ?? []).filter((f) => f.type === "folder");
  const looseFiles = (rootNodes ?? []).filter((f) => f.type !== "folder");

  const folders: Folder[] = folderNodes.map((f) => ({
    id: f.id,
    name: f.title,
    owner: resolveOwner(f.createdBy),
  }));

  // Drop just-uploaded files from the spinner set once they reach a terminal state.
  useEffect(() => {
    if (pending.size === 0) return;
    const terminal = new Set(
      looseFiles.filter((f) => f.indexStatus === "done" || f.indexStatus === "error").map((f) => f.id),
    );
    if ([...pending].some((id) => terminal.has(id))) {
      setPending((prev) => new Set([...prev].filter((id) => !terminal.has(id))));
    }
  }, [rootNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while anything is still indexing so the status resolves on its own.
  const anyIndexing = pending.size > 0 || looseFiles.some((f) => f.indexStatus === "indexing");
  useEffect(() => {
    if (!anyIndexing) return;
    const t = setInterval(() => void invalidateFiles(qc, workspace.id, null), 3000);
    return () => clearInterval(t);
  }, [anyIndexing, qc, workspace.id]);

  async function onRootFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
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
        // No parentId → uploads land at the workspace root.
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
    await invalidateFiles(qc, workspace.id, null);
    setUploading(false);
    if (ok > 0) toast(`Uploaded ${ok} ${ok === 1 ? "file" : "files"} — indexing into memory…`);
  }

  async function handleCreate(name: string, staged: UploadedFile[]) {
    try {
      const { file } = await createFolder.mutateAsync(name);
      setModalOpen(false);
      toast("Folder created");

      // Best-effort: upload any staged files into the new folder.
      const toUpload = staged.filter((u): u is UploadedFile & { file: File } => !!u.file);
      if (toUpload.length > 0) {
        await Promise.all(
          toUpload.map(async (u) => {
            const fd = new FormData();
            fd.append("file", u.file);
            fd.append("workspaceId", workspace.id);
            fd.append("parentId", file.id);
            try {
              const up = await fetch("/api/files/upload", { method: "POST", body: fd });
              if (!up.ok) throw new Error("upload failed");
            } catch {
              toast(`Could not upload ${u.name}`);
            }
          })
        );
      }
    } catch {
      toast("Could not create folder");
    }
  }

  function handleRemove(id: string) {
    deleteFile.mutate(id);
    toast("Folder removed");
  }

  function handleRemoveFile(id: string, name: string) {
    deleteFile.mutate(id);
    toast(`Removed ${name}`);
  }

  // Browse-all is a unified, searchable list of folders + loose files.
  const browseAll: BrowseEntry[] = [
    ...folders.map((f) => ({ kind: "folder" as const, id: f.id, folder: f })),
    ...looseFiles.map((f) => ({
      kind: "file" as const,
      id: f.id,
      file: f,
      owner: resolveOwner(f.createdBy),
    })),
  ];

  const q = query.trim().toLowerCase();
  const filtered = browseAll.filter((e) => {
    if (!q) return true;
    if (e.kind === "folder") {
      return e.folder.name.toLowerCase().includes(q) || e.folder.owner.toLowerCase().includes(q);
    }
    return e.file.title.toLowerCase().includes(q) || e.owner.toLowerCase().includes(q);
  });

  const hasNothing = folders.length === 0 && looseFiles.length === 0;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div
        className="pane"
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "8px 40px 60px",
        }}
      >
        {/* ————— header ————— */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 27,
                letterSpacing: "-0.02em",
                margin: 0,
                color: "var(--ink)",
              }}
            >
              Folders
            </h1>
            <p
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                lineHeight: 1.5,
                marginTop: 4,
                marginBottom: 0,
                maxWidth: 520,
              }}
            >
              Organize folders and files in one place. Uploaded documents are
              indexed into memory so the agent can reference them.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <input
              ref={rootFileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={onRootFilesPicked}
            />
            <button
              className="btn btn-outline"
              disabled={uploading}
              onClick={() => rootFileInputRef.current?.click()}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <Upload className="lucide" aria-hidden style={{ width: 15, height: 15 }} />
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <Plus className="lucide" aria-hidden style={{ width: 15, height: 15 }} />
              New folder
            </button>
          </div>
        </div>

        {/* ————— folder grid ————— */}
        {isLoading ? (
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : hasNothing ? (
          <div style={{ marginTop: 18 }}>
            <AgentEmptyBlock
              icon={FolderClosed}
              title="No folders or files yet"
              hint="Create a folder to group your work, or upload a document — uploads become searchable by the agent."
              actionLabel="New folder"
              onAction={() => setModalOpen(true)}
            />
          </div>
        ) : folders.length > 0 ? (
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {folders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                onOpen={() => onOpenFolder?.(f)}
                onRemove={() => handleRemove(f.id)}
              />
            ))}
          </div>
        ) : null}

        {/* ————— browse all (folders + loose files) ————— */}
        {!hasNothing && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 10,
              }}
            >
              Browse all
            </div>

            <div style={{ position: "relative", marginBottom: 6 }}>
              <Search
                className="lucide"
                aria-hidden
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 15,
                  height: 15,
                  color: "var(--ink-3)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                aria-label="Search folders and files"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or owner"
                style={{ width: "100%", paddingLeft: 34 }}
              />
            </div>

            <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)" }}>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <div style={{ padding: "18px 14px", fontSize: 13, color: "var(--ink-3)" }}>
                  No folders or files match “{query}”.
                </div>
              ) : (
                filtered.map((e, i) =>
                  e.kind === "folder" ? (
                    <FolderRow
                      key={e.id}
                      folder={e.folder}
                      last={i === filtered.length - 1}
                      onOpen={() => onOpenFolder?.(e.folder)}
                      onRemove={() => handleRemove(e.id)}
                    />
                  ) : (
                    <FileRow
                      key={e.id}
                      file={e.file}
                      owner={e.owner}
                      pending={pending.has(e.id)}
                      last={i === filtered.length - 1}
                      onOpen={onOpenFile ? () => onOpenFile(e.file.id, e.file.title) : undefined}
                      onRemove={() => handleRemoveFile(e.id, e.file.title)}
                    />
                  ),
                )
              )}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <NewFolderModal
          onClose={() => setModalOpen(false)}
          onCreate={(name, staged) => handleCreate(name, staged)}
        />
      )}
    </div>
  );
}

/* ————————————————————————————————————————————— folder card ——— */

function FolderCard({
  folder,
  onOpen,
  onRemove,
}: {
  folder: Folder;
  onOpen?: () => void;
  onRemove?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      style={{
        position: "relative",
        background: hover ? "#ececec" : "var(--hover-soft)",
        border: "none",
        borderRadius: 16,
        padding: 16,
        height: 132,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        transition: "background 0.14s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <FolderClosed
          className="lucide"
          aria-hidden
          style={{ width: 20, height: 20, color: "var(--ink-2)" }}
        />
        <button
          className="iconbtn"
          aria-label="Remove folder"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          style={{
            opacity: hover ? 1 : 0,
            transition: "opacity 0.14s ease",
            marginTop: -2,
            marginRight: -4,
          }}
        >
          <MoreHorizontal
            className="lucide"
            aria-hidden
            style={{ width: 18, height: 18 }}
          />
        </button>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
        {folder.name}
      </div>
    </div>
  );
}

/* ————————————————————————————————————————————— folder row ——— */

function FolderRow({
  folder,
  onRemove,
  onOpen,
  last,
}: {
  folder: Folder;
  onRemove: () => void;
  onOpen?: () => void;
  last: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        height: 64,
        padding: "0 8px",
        cursor: "pointer",
        background: hover ? "var(--hover-soft)" : "transparent",
        transition: "background 0.1s ease",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          minWidth: 0,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "var(--hover-soft)",
            flexShrink: 0,
          }}
        >
          <FolderIcon
            className="lucide"
            aria-hidden
            style={{ width: 17, height: 17, color: "var(--ink-2)" }}
          />
        </span>
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {folder.name}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13.5, color: "var(--ink-3)" }}>
          {folder.owner}
        </span>
        <button
          className="btn btn-outline"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ fontSize: 12.5 }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/* ————————————————————————————————————————————— file row ——— */

function fileExt(title: string): string {
  const dot = title.lastIndexOf(".");
  return dot > 0 ? title.slice(dot + 1).toLowerCase() : "";
}

function fileKindLabel(node: FileNode): string {
  if (node.type === "page") return "Page";
  const ext = fileExt(node.title);
  return ext ? ext.toUpperCase() : "File";
}

function formatFileDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function FileIndexBadge({ status, pending }: { status: string | null | undefined; pending: boolean }) {
  const indexing = (pending || status === "indexing") && status !== "error";
  if (status === "error") {
    return (
      <span
        title="Couldn't read this file — it wasn't added to memory."
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--red)", flexShrink: 0 }}
      >
        <AlertCircle size={14} aria-hidden />
        Not indexed
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        title="Indexed into memory — searchable by the agent"
        style={{ display: "inline-flex", alignItems: "center", fontSize: 12, color: "var(--green)", flexShrink: 0 }}
      >
        <Check size={15} aria-hidden />
      </span>
    );
  }
  if (indexing) {
    return (
      <span
        title="Indexing into memory…"
        aria-label="Indexing into memory"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}
      >
        <Loader2 size={14} className="rc-spin" aria-hidden />
        Indexing…
      </span>
    );
  }
  return null;
}

function FileRow({
  file,
  owner,
  pending,
  last,
  onOpen,
  onRemove,
}: {
  file: FileNode;
  owner: string;
  pending: boolean;
  last: boolean;
  onOpen?: () => void;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  const isPdf = fileExt(file.title) === "pdf";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        height: 64,
        padding: "0 8px",
        cursor: onOpen ? "pointer" : "default",
        background: hover ? "var(--hover-soft)" : "transparent",
        transition: "background 0.1s ease",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 9,
            background: isPdf ? "rgba(220,38,38,.1)" : "var(--hover-soft)",
            color: isPdf ? "#dc2626" : "var(--ink-2)",
            flexShrink: 0,
          }}
        >
          <FileText className="lucide" aria-hidden style={{ width: 17, height: 17 }} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 14.5,
              fontWeight: 600,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.title}
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
            {fileKindLabel(file)} · {formatFileDate(file.updatedAt)}
          </span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <FileIndexBadge status={file.indexStatus} pending={pending} />
        <span style={{ fontSize: 13.5, color: "var(--ink-3)" }}>{owner}</span>
        <button
          className="btn btn-outline"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ fontSize: 12.5, opacity: hover ? 1 : 0, transition: "opacity 0.12s ease" }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/* ——————————————————————————————————————————— new folder modal ——— */

function NewFolderModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, staged: UploadedFile[]) => void;
}) {
  const [name, setName] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("invite");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus into the dialog on open.
  useEffect(() => {
    nameRef.current?.focus();
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

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked) return;
    const added: UploadedFile[] = Array.from(picked).map((f) => ({
      id: nextId(),
      name: f.name,
      file: f,
    }));
    setFiles((prev) => [...prev, ...added]);
    e.target.value = "";
  }

  const canCreate = name.trim().length > 0;

  return (
    <>
      <div className="palette-veil" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className="rc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-folder-title"
        onKeyDown={handleTrap}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 60,
          width: "min(560px, 92vw)",
          background: "var(--bg)",
          borderRadius: 16,
          boxShadow:
            "0 0 0 1px rgba(0,0,0,.06), 0 28px 80px -14px rgba(0,0,0,.32)",
          padding: 22,
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              id="new-folder-title"
              style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}
            >
              New folder
            </div>
            <div
              style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 4 }}
            >
              Folders let you save content and chats in one place
            </div>
          </div>
          <button
            className="iconbtn"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="lucide" aria-hidden style={{ width: 17, height: 17 }} />
          </button>
        </div>

        {/* name */}
        <input
          ref={nameRef}
          type="text"
          aria-label="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          style={{ width: "100%", marginTop: 16 }}
        />

        {/* upload area */}
        <div
          style={{
            marginTop: 12,
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 14,
            minHeight: 120,
            background: "var(--base)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ flex: 1 }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={uploadActionStyle}
            >
              Browse
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={uploadActionStyle}
            >
              Upload
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onFilesPicked}
            style={{ display: "none" }}
          />

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            {files.map((f) => (
              <UploadedRow
                key={f.id}
                file={f}
                onRemove={() =>
                  setFiles((prev) => prev.filter((x) => x.id !== f.id))
                }
              />
            ))}
            {files.length === 0 && (
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-3)",
                  padding: "4px 2px",
                }}
              >
                No files yet — Browse or Upload to add some.
              </div>
            )}
          </div>
        </div>

        {/* more options toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            border: "none",
            background: "transparent",
            color: "var(--ink-2)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            padding: 0,
          }}
        >
          {expanded ? "Less options" : "More options"}
          <ChevronDown
            className="lucide"
            aria-hidden
            style={{
              width: 15,
              height: 15,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
        </button>

        {expanded && (
          <div style={{ marginTop: 12 }}>
            <textarea
              aria-label="Folder description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your folder's goals, subject, or purpose"
              rows={3}
              style={{
                width: "100%",
                fontFamily: "inherit",
                fontSize: 13,
                color: "var(--ink)",
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "8px 12px",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />

            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                Visibility
              </div>
              <div
                role="radiogroup"
                aria-label="Visibility"
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <RadioRow
                  selected={visibility === "invite"}
                  onSelect={() => setVisibility("invite")}
                  title="Invite only"
                  desc="Only invited members in your workspace can use"
                />
                <RadioRow
                  selected={visibility === "all"}
                  onSelect={() => setVisibility("all")}
                  title="Added to all members"
                  desc="Everyone in your workspace can view and use"
                />
              </div>
            </div>
          </div>
        )}

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 22,
          }}
        >
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!canCreate}
            onClick={() => onCreate(name.trim(), files)}
          >
            Create
          </button>
        </div>
      </div>
    </>
  );
}

const uploadActionStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--ink-2)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
};

function UploadedRow({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 8px",
        borderRadius: 8,
        background: hover ? "var(--hover-soft)" : "transparent",
        transition: "background 0.1s ease",
      }}
    >
      <FileText
        className="lucide"
        aria-hidden
        style={{ width: 16, height: 16, color: "var(--ink-2)" }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {file.name}
      </span>
      <button
        onClick={onRemove}
        aria-label="Remove file"
        style={{
          display: hover ? "flex" : "none",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          color: "var(--ink-3)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <X className="lucide" aria-hidden style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

function RadioRow({
  selected,
  onSelect,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: "6px 4px",
        borderRadius: 8,
        fontFamily: "inherit",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          flexShrink: 0,
          marginTop: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: selected ? "var(--green)" : "transparent",
          border: selected ? "1px solid var(--green)" : "1px solid var(--line)",
          transition: "background 0.12s ease, border-color 0.12s ease",
        }}
      >
        {selected && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#fff",
            }}
          />
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {" — "}
          {desc}
        </span>
      </span>
    </button>
  );
}
