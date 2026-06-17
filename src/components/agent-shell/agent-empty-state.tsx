"use client";

import { ChevronDown, FolderGit2, Layers, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AgentComposer } from "./agent-composer";
import { SlackLogo, GitHubLogo, GoogleDriveLogo } from "./agent-brand-icons";
import type { ModelProfile } from "./types";

function ContextPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={() => toast("Scope selectors arrive in a later slice")}
      className="flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12.5px] transition-colors"
      style={{ color: "var(--agent-text-muted)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: "var(--agent-text-faint)" }}>{icon}</span>
      {label}
      <ChevronDown className="size-3.5 opacity-70" />
    </button>
  );
}

interface Props {
  onSend: (text: string, focusFileIds?: string[]) => void;
  onStop: () => void;
  status: "ready" | "submitted" | "streaming" | "error";
  modelProfile: ModelProfile;
  onModelProfileChange: (p: ModelProfile) => void;
}

const CONNECTORS = [
  { Logo: SlackLogo, title: "Connect messaging", desc: "Catch up on team threads and customer chats" },
  { Logo: GitHubLogo, title: "Connect GitHub", desc: "Review PRs, code, and CI checks" },
  { Logo: GoogleDriveLogo, title: "Connect Drive", desc: "Pull briefs, docs, and reports" },
];

export function AgentEmptyState({ onSend, onStop, status, modelProfile, onModelProfileChange }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6">
      <div className="w-full max-w-[720px] pb-16">
        <h1
          className="mb-6 text-center text-[29px] font-medium tracking-[-0.02em]"
          style={{ color: "var(--agent-text)" }}
        >
          What should we work on?
        </h1>

        <AgentComposer
          onSend={onSend}
          onStop={onStop}
          status={status}
          modelProfile={modelProfile}
          onModelProfileChange={onModelProfileChange}
          autoFocus
          placeholder="Do anything"
        />

        {/* Context tray — workspace / source scope / memory scope */}
        <div
          className="mt-2 flex items-center gap-0.5 rounded-[10px] px-1.5 py-1"
          style={{ background: "#f3f3f4" }}
        >
          <ContextPill icon={<FolderGit2 className="size-[15px]" />} label="500Chow" />
          <ContextPill icon={<Layers className="size-[15px]" />} label="All sources" />
          <ContextPill icon={<UserRound className="size-[15px]" />} label="Personal memory" />
        </div>

        {/* Connect cards */}
        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CONNECTORS.map((c) => (
            <button
              key={c.title}
              type="button"
              onClick={() => toast(`${c.title} — connector flow coming in a later slice`)}
              className="group flex h-full flex-col items-start rounded-[var(--agent-radius-card)] border bg-card p-4 text-left transition-all duration-150"
              style={{ borderColor: "var(--agent-border)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--agent-border-strong)";
                e.currentTarget.style.boxShadow = "var(--agent-shadow-composer)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--agent-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <c.Logo className="size-[22px]" />
              <span className="mt-3.5 text-[13.5px] font-medium" style={{ color: "var(--agent-text)" }}>
                {c.title}
              </span>
              <span className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--agent-text-muted)" }}>
                {c.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
