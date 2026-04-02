"use client";

import { useEffect, useState, useCallback, useRef, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { FilePlus, Upload, Search } from "lucide-react";
import { FileTree } from "./file-tree";
import { createClient } from "@/lib/supabase/client";
import type { FileTreeNode } from "@/lib/files/types";
import { cn } from "@/lib/utils";

export function FilesSidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [nodes, setNodes] = useState<FileTreeNode[]>([]);
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileTreeNode } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fileIdMatch = pathname.match(/\/files\/([^/]+)/);
  const activeFileId = fileIdMatch ? fileIdMatch[1] : null;

  const loadFiles = useCallback(async () => {
    const res = await fetch(`/api/files?workspaceId=${workspace.id}`);
    const data = await res.json();
    setNodes(data.files || []);
  }, [workspace.id]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Realtime subscription for tree updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`files:${workspace.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "files", filter: `workspace_id=eq.${workspace.id}` },
        () => { loadFiles(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspace.id, loadFiles]);

  // Close context menu on click outside
  useEffect(() => {
    function handleClick(e: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleCreatePage(parentId?: string) {
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, type: "page", title: "Untitled", parentId: parentId || null }),
    });
    const data = await res.json();
    if (data.file) {
      router.push(`/${workspace.slug}/files/${data.file.id}`);
    }
  }

  function handleUploadClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      for (const file of Array.from(input.files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("workspaceId", workspace.id);
        await fetch("/api/files/upload", { method: "POST", body: formData });
      }
    };
    input.click();
  }

  function handleSelect(node: FileTreeNode) {
    router.push(`/${workspace.slug}/files/${node.id}`);
    setContextMenu(null);
  }

  function handleContextMenu(e: MouseEvent, node: FileTreeNode) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }

  async function handleRename(node: FileTreeNode) {
    const newTitle = prompt("Rename:", node.title);
    if (newTitle && newTitle !== node.title) {
      await fetch(`/api/files/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
    }
    setContextMenu(null);
  }

  async function handleDelete(node: FileTreeNode) {
    if (!confirm(`Delete "${node.title}"? This will also delete all children.`)) return;
    await fetch(`/api/files/${node.id}`, { method: "DELETE" });
    setContextMenu(null);
    if (activeFileId === node.id) router.push(`/${workspace.slug}/files`);
  }

  async function handleTogglePrivate(node: FileTreeNode) {
    await fetch(`/api/files/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrivate: !node.isPrivate }),
    });
    setContextMenu(null);
  }

  const filteredNodes = search
    ? nodes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : nodes;

  const recentFiles = [...nodes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <>
      {/* Actions */}
      <div className="flex items-center gap-1 px-3 mb-2">
        <button
          onClick={() => handleCreatePage()}
          className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
          style={{ color: "var(--sidebar-text-muted)" }}
          title="New page"
        >
          <FilePlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleUploadClick}
          className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
          style={{ color: "var(--sidebar-text-muted)" }}
          title="Upload file"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 opacity-40" style={{ color: "var(--sidebar-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-7 pr-2 py-1.5 rounded-md text-[12px] border-0 outline-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "var(--sidebar-text)",
            }}
          />
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        <FileTree
          nodes={search ? filteredNodes : nodes}
          activeFileId={activeFileId}
          onSelect={handleSelect}
          onCreateChild={(parentId) => handleCreatePage(parentId)}
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* Recently edited */}
      {!search && recentFiles.length > 0 && (
        <div className="border-t pt-2 mt-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--sidebar-text-muted)" }}>
            Recently edited
          </div>
          {recentFiles.map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 px-3 py-1 cursor-pointer text-[12px] rounded-md mx-1"
              style={{ color: "var(--sidebar-text-muted)" }}
              onClick={() => handleSelect(node)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="text-xs">{node.icon || (node.type === "page" ? "📄" : node.type === "folder" ? "📁" : "📎")}</span>
              <span className="truncate flex-1">{node.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 py-1 min-w-[160px] rounded-lg border shadow-xl"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            background: "var(--sidebar-bg)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          {[
            { label: "Rename", action: () => handleRename(contextMenu.node) },
            { label: contextMenu.node.isPrivate ? "Make public" : "Make private", action: () => handleTogglePrivate(contextMenu.node) },
            { label: "Delete", action: () => handleDelete(contextMenu.node), danger: true },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[13px] transition-colors",
                item.danger ? "text-red-400" : ""
              )}
              style={{ color: item.danger ? undefined : "var(--sidebar-text)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
