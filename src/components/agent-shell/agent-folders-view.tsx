"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  FolderClosed,
  Folder as FolderIcon,
  MoreHorizontal,
  Search,
  X,
  FileText,
  ChevronDown,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace/context";

interface Folder {
  id: string;
  name: string;
  owner: string;
}

interface UploadedFile {
  id: string;
  name: string;
  file?: File;
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
}

type Visibility = "invite" | "all";

let idSeq = 0;
const nextId = () => `id-${++idSeq}-${Date.now()}`;

export function AgentFoldersView({ onOpenFolder }: { onOpenFolder?: (folder: Folder) => void } = {}) {
  const { workspace, members } = useWorkspace();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const resolveOwner = (createdBy: string) =>
    members.find((m) => m.userId === createdBy)?.fullName ?? "—";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/files?workspaceId=${workspace.id}&parentId=null`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load folders"))))
      .then((data: { files: FileNode[] }) => {
        if (cancelled) return;
        const topFolders = (data.files || [])
          .filter((f) => f.type === "folder")
          .map((f) => ({ id: f.id, name: f.title, owner: resolveOwner(f.createdBy) }));
        setFolders(topFolders);
      })
      .catch(() => {
        if (!cancelled) toast("Could not load folders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id, members]);

  async function handleCreate(name: string, staged: UploadedFile[]) {
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          title: name,
          type: "folder",
          parentId: null,
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const { file } = (await res.json()) as { file: { id: string; title: string; createdBy: string } };
      setFolders((prev) => [
        ...prev,
        { id: file.id, name: file.title, owner: resolveOwner(file.createdBy) },
      ]);
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

  async function handleRemove(id: string) {
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setFolders((prev) => prev.filter((x) => x.id !== id));
      toast("Folder removed");
    } catch {
      toast("Could not remove folder");
    }
  }

  const filtered = folders.filter((f) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) || f.owner.toLowerCase().includes(q)
    );
  });

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
              Add and remove folders from your sidebar in the table below, and
              organize folders by dragging and dropping directly in the sidebar
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
            }}
          >
            <Plus className="lucide" aria-hidden style={{ width: 15, height: 15 }} />
            New folder
          </button>
        </div>

        {/* ————— folder grid ————— */}
        {loading ? (
          <div
            style={{
              marginTop: 24,
              fontSize: 13.5,
              color: "var(--ink-3)",
            }}
          >
            Loading folders…
          </div>
        ) : folders.length === 0 ? (
          <div
            style={{
              marginTop: 24,
              fontSize: 13.5,
              color: "var(--ink-3)",
            }}
          >
            No folders yet — create one to get started.
          </div>
        ) : (
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
        )}

        {/* ————— browse all ————— */}
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

          <div
            style={{
              position: "relative",
              marginBottom: 6,
            }}
          >
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
              aria-label="Search folders"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, description, or owner"
              style={{ width: "100%", paddingLeft: 34 }}
            />
          </div>

          <div
            style={{
              marginTop: 12,
              borderTop: "1px solid var(--line-soft)",
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "18px 14px",
                  fontSize: 13,
                  color: "var(--ink-3)",
                }}
              >
                No folders match “{query}”.
              </div>
            ) : (
              filtered.map((f, i) => (
                <FolderRow
                  key={f.id}
                  folder={f}
                  last={i === filtered.length - 1}
                  onOpen={() => onOpenFolder?.(f)}
                  onRemove={() => handleRemove(f.id)}
                />
              ))
            )}
          </div>
        </div>
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
