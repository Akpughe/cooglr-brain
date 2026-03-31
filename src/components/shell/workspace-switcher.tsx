"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Workspace } from "@/lib/apps/types";
import { Check, Plus } from "lucide-react";

interface WorkspaceSwitcherProps {
  activeWorkspace: Workspace;
}

export function WorkspaceSwitcher({ activeWorkspace }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<(Workspace & { role: string })[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/workspaces")
        .then((r) => r.json())
        .then((data) => setWorkspaces(data.workspaces || []));
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchWorkspace(slug: string) {
    setOpen(false);
    router.push(`/${slug}`);
  }

  const initial = activeWorkspace.name?.[0]?.toUpperCase() || "W";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-[34px] h-[34px] rounded-[9px] bg-foreground text-background flex items-center justify-center font-bold text-[13px] hover:opacity-90 transition-opacity"
        title={activeWorkspace.name}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute left-[52px] top-0 z-50 w-[240px] bg-popover border border-border rounded-xl shadow-lg py-1 animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workspaces
            </p>
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => switchWorkspace(ws.slug)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-sm transition-colors"
            >
              <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
                {ws.name[0].toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium truncate">{ws.name}</div>
                <div className="text-xs text-muted-foreground">{ws.role}</div>
              </div>
              {ws.id === activeWorkspace.id && (
                <Check className="w-4 h-4 text-foreground shrink-0" />
              )}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); router.push("/onboarding"); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-sm transition-colors text-muted-foreground"
            >
              <div className="w-7 h-7 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span>Create new workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
