// Shared types for the chat-first agent shell.

export type ModelProfile = "auto" | "fast" | "deep";

export interface ThreadSummary {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: string | null;
}

export interface Citation {
  fileId: string;
  score: number;
}

// A canvas artifact derived from a tool result (slice 1: source-grounded answers).
export interface AgentArtifact {
  id: string;
  kind: "source_trace" | "chart";
  title: string;
  source?: "database" | "content";
  sql?: string | null;
  citations?: Citation[];
  origins?: string[];
  chart?: unknown;
}

export const MODEL_PROFILE_LABELS: Record<ModelProfile, { label: string; hint: string }> = {
  auto: { label: "Auto", hint: "Routes to the right model per task" },
  fast: { label: "Fast", hint: "Low-latency model for quick answers" },
  deep: { label: "Deep", hint: "Strongest model for analysis & reports" },
};
