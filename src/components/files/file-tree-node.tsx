"use client";

import { useState, type MouseEvent } from "react";
import { ChevronRight, ChevronDown, File, Folder, FileText, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileTreeNode as FileTreeNodeType } from "@/lib/files/types";

interface Props {
  node: FileTreeNodeType;
  children: FileTreeNodeType[];
  allNodes: FileTreeNodeType[];
  activeFileId: string | null;
  depth: number;
  onSelect: (node: FileTreeNodeType) => void;
  onCreateChild: (parentId: string) => void;
  onContextMenu: (e: MouseEvent, node: FileTreeNodeType) => void;
}

function getIcon(node: FileTreeNodeType) {
  if (node.icon) return <span className="text-sm">{node.icon}</span>;
  switch (node.type) {
    case "folder": return <Folder className="w-4 h-4 text-yellow-400/70" />;
    case "page": return <FileText className="w-4 h-4 text-blue-400/70" />;
    case "file": return <File className="w-4 h-4 text-gray-400/70" />;
  }
}

export function FileTreeNode({ node, children, allNodes, activeFileId, depth, onSelect, onCreateChild, onContextMenu }: Props) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isActive = node.id === activeFileId;
  const hasChildren = children.length > 0;
  const isFolder = node.type === "folder";
  const canExpand = isFolder || hasChildren;

  function handleClick() {
    if (isFolder && !hasChildren) {
      onSelect(node);
      return;
    }
    if (canExpand) {
      setExpanded(!expanded);
    }
    onSelect(node);
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-[5px] rounded-md cursor-pointer text-[13px] transition-colors",
          isActive ? "font-medium" : ""
        )}
        style={{
          paddingLeft: `${8 + depth * 20}px`,
          color: isActive ? "var(--sidebar-text)" : "var(--sidebar-text-muted)",
          background: isActive ? "var(--sidebar-hover)" : "transparent",
        }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {canExpand ? (
            expanded ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />
          ) : null}
        </span>
        <span className="shrink-0">{getIcon(node)}</span>
        <span className="truncate flex-1">{node.title}</span>
        {node.isPrivate && <Lock className="w-3 h-3 opacity-30 shrink-0" />}
        {(isFolder || node.type === "page") && (
          <button
            className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-50 hover:!opacity-100 shrink-0"
            onClick={(e) => { e.stopPropagation(); onCreateChild(node.id); }}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {children
            .sort((a, b) => a.position - b.position)
            .map((child) => (
              <FileTreeNode
                key={child.id}
                node={child}
                children={allNodes.filter((n) => n.parentId === child.id)}
                allNodes={allNodes}
                activeFileId={activeFileId}
                depth={depth + 1}
                onSelect={onSelect}
                onCreateChild={onCreateChild}
                onContextMenu={onContextMenu}
              />
            ))}
        </div>
      )}
    </div>
  );
}
