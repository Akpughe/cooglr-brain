"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Check, Database, FileText, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RunStep {
  id: string;
  name: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  question?: string;
  source?: "database" | "content";
  origins?: string[];
}

function prettyToolName(name: string): string {
  if (name.includes("knowledge")) return "Searched workspace knowledge";
  return name.replace(/^tool-/, "").replace(/[_-]/g, " ");
}

export function AgentRunSteps({
  steps,
  busy,
  durationLabel,
}: {
  steps: RunStep[];
  busy: boolean;
  durationLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  const done = steps.every((s) => s.state === "output-available" || s.state === "output-error");
  const working = busy && !done;
  const summary = working ? "Working" : durationLabel ? `Worked for ${durationLabel}` : "Worked";

  return (
    <div className="mb-3">
      {/* Divider above the row, Codex-style */}
      <div className="border-t pt-3" style={{ borderColor: "var(--agent-border)" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex w-full items-center gap-1.5 text-[13.5px] transition-colors"
          style={{ color: "var(--agent-text-muted)" }}
        >
          {working && <Loader2 className="size-3.5 animate-spin" />}
          <span className={cn(working && "agent-thinking")}>{summary}</span>
          <ChevronRight className={cn("size-4 transition-transform duration-150", open && "rotate-90")} />
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-1.5 agent-rise">
          {steps.map((s) => {
            const Icon = s.source === "database" ? Database : s.source === "content" ? FileText : Wrench;
            return (
              <div
                key={s.id}
                className="flex items-start gap-2.5 rounded-[var(--agent-radius-card)] border px-3 py-2.5"
                style={{ borderColor: "var(--agent-border)", background: "var(--agent-rail)" }}
              >
                <span className="mt-0.5 shrink-0">
                  {s.state === "output-available" ? (
                    <Check className="size-3.5" style={{ color: "var(--agent-text-muted)" }} />
                  ) : s.state === "output-error" ? (
                    <span className="block size-3.5 rounded-full" style={{ background: "var(--destructive)" }} />
                  ) : (
                    <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--agent-text-faint)" }} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px]" style={{ color: "var(--agent-text)" }}>
                    <Icon className="size-3.5" style={{ color: "var(--agent-text-faint)" }} />
                    {prettyToolName(s.name)}
                  </div>
                  {s.question && (
                    <div className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--agent-text-muted)" }}>
                      “{s.question}”
                    </div>
                  )}
                  {s.origins && s.origins.length > 0 && (
                    <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--agent-text-faint)" }}>
                      from {s.origins.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
