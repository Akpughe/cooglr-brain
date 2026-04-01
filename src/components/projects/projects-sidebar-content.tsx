"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { Plus } from "lucide-react";
import { CreateProjectModal } from "./create-project-modal";
import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

export function ProjectsSidebarContent() {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const workspaceBase = `/${workspace.slug}/projects`;

  useEffect(() => {
    fetch(`/api/projects?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []));
  }, [workspace.id]);

  return (
    <>
      <div className="mb-3">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--sidebar-text-muted)" }}>
            Projects
          </span>
          <button
            onClick={() => setShowCreate(true)}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-px">
          {projects.map((proj) => {
            const path = `${workspaceBase}/${proj.id}`;
            const active = pathname === path;
            return (
              <Link
                key={proj.id}
                href={path}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 mx-2 rounded-md text-[13px] transition-colors",
                  active ? "font-medium" : ""
                )}
                style={{
                  color: active ? "var(--sidebar-text)" : "var(--sidebar-text-muted)",
                  background: active ? "var(--sidebar-hover)" : "transparent",
                }}
              >
                <span className="truncate">{proj.name}</span>
                <span className="text-[11px] opacity-50">{proj.taskCount || 0}</span>
              </Link>
            );
          })}
          {projects.length === 0 && (
            <div className="px-4 py-3">
              <p className="text-xs" style={{ color: "var(--sidebar-text-muted)" }}>No projects yet</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateProjectModal
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          onClose={() => setShowCreate(false)}
          onCreate={(project) => {
            setProjects((prev) => [...prev, project]);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}
