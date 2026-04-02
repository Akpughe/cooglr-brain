"use client";

import { type MouseEvent } from "react";
import { FileTreeNode } from "./file-tree-node";
import type { FileTreeNode as FileTreeNodeType } from "@/lib/files/types";

interface Props {
  nodes: FileTreeNodeType[];
  activeFileId: string | null;
  onSelect: (node: FileTreeNodeType) => void;
  onCreateChild: (parentId: string) => void;
  onContextMenu: (e: MouseEvent, node: FileTreeNodeType) => void;
}

export function FileTree({ nodes, activeFileId, onSelect, onCreateChild, onContextMenu }: Props) {
  const rootNodes = nodes
    .filter((n) => n.parentId === null)
    .sort((a, b) => a.position - b.position);

  if (rootNodes.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs" style={{ color: "var(--sidebar-text-muted)" }}>
          No files yet. Create a page to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootNodes.map((node) => (
        <FileTreeNode
          key={node.id}
          node={node}
          children={nodes.filter((n) => n.parentId === node.id)}
          allNodes={nodes}
          activeFileId={activeFileId}
          depth={0}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
