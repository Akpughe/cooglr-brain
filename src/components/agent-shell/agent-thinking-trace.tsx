"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export interface TraceStep {
  index: number;
  tool: string;
  text: string;
}

/**
 * The agent's live "thinking" trace: one row per narrated step. Expanded while
 * the agent is still working (no final answer yet), auto-collapsed once the
 * answer has arrived; the user can toggle either way.
 */
export function AgentThinkingTrace({ steps, answered }: { steps: TraceStep[]; answered: boolean }) {
  const [override, setOverride] = useState<boolean | null>(null);
  if (steps.length === 0) return null;

  const open = override ?? !answered;
  const label = answered
    ? `Thought through ${steps.length} step${steps.length === 1 ? "" : "s"}`
    : "Thinking…";

  return (
    <div className="agent-trace">
      <button
        type="button"
        className="btn-ghost agent-trace-toggle"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
      >
        <ChevronRight
          size={14}
          style={{ transform: open ? "rotate(90deg)" : "", transition: "transform .15s ease" }}
        />
        <span>{label}</span>
      </button>
      {open && (
        <ol className="agent-trace-steps">
          {[...steps]
            .sort((a, b) => a.index - b.index)
            .map((s) => (
              <li key={s.index} className="agent-trace-step">
                {s.text}
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
