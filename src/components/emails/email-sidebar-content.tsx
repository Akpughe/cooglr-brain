"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { Send, FileText, Users, BarChart3, Settings, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "campaigns", label: "Campaigns", icon: Send },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function EmailSidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace } = useWorkspace();

  const workspaceBase = `/${workspace.slug}/email-marketing`;

  // Extract active section from pathname or default to campaigns
  const pathSection = pathname.replace(workspaceBase, "").replace(/^\//, "").split("/")[0];
  const activeSection = SECTIONS.find((s) => s.id === pathSection)?.id || "campaigns";

  return (
    <div className="mb-3">
      <div className="px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--sidebar-text-muted)" }}>
          Email Marketing
        </span>
      </div>
      <div className="space-y-px">
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => router.push(`${workspaceBase}/${section.id}`)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 mx-2 rounded-md text-[13px] transition-colors text-left",
                active ? "font-medium" : ""
              )}
              style={{
                color: active ? "var(--sidebar-text)" : "var(--sidebar-text-muted)",
                background: active ? "var(--sidebar-hover)" : "transparent",
                maxWidth: "calc(100% - 16px)",
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 opacity-50" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
