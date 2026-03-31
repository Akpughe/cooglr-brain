"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { InstalledApp, Workspace, WorkspaceMember } from "@/lib/apps/types";

interface WorkspaceContextValue {
  workspace: Workspace;
  membership: {
    role: "owner" | "member";
  };
  installedApps: InstalledApp[];
  members: WorkspaceMember[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WorkspaceContextValue;
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

export function useIsOwner(): boolean {
  const { membership } = useWorkspace();
  return membership.role === "owner";
}
