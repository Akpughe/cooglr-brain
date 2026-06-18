"use client";

// Scratch harness for the approval card — renders AgentApprovalCard against a
// MOCK decision handler (no DB, no Gmail, no auth). Lets you click through the
// full interaction (approve → sending → executed, decline, failure) visually
// today, while the real backend (Supabase + Composio Gmail) is unavailable.
//
// Visit /dev/approvals-preview. Not linked anywhere; dev-only.

import { AgentApprovalCard, type DecideFn } from "@/components/agent-shell/agent-approval-card";
import type { ApprovalStatus, ApprovalView } from "@/lib/agent/approvals/types";

const base: Omit<ApprovalView, "status"> = {
  id: "preview",
  actionType: "send_email",
  actionLabel: "Send email",
  title: "Send launch update to the growth team",
  summary: "Drafted from your last message. Review the recipients and body before it sends.",
  riskLevel: "high",
  preview: {
    to: ["growth@500.co", "alex@mulla.africa"],
    subject: "Launch update — week 24",
    body: "Hi team,\n\nHere's where we landed this week:\n\n• Merchant activation up 12%\n• Two blockers cleared\n\nFull numbers in the dashboard.\n\n— Alex",
  },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A mock submit that simulates the server round-trip and returns a chosen
// terminal state, so each scenario exercises a different outcome.
function mockSubmit(approveOutcome: ApprovalStatus, error?: string): DecideFn {
  return async (id, decision) => {
    await wait(700);
    if (decision === "decline") return { ...base, id, status: "declined" };
    return { ...base, id, status: approveOutcome, error: error ?? null };
  };
}

function Scenario({
  title,
  approval,
  submit,
}: {
  title: string;
  approval: ApprovalView;
  submit: DecideFn;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3)", marginBottom: 8 }}>{title}</h2>
      <AgentApprovalCard approval={approval} submit={submit} />
    </section>
  );
}

export default function ApprovalsPreviewPage() {
  return (
    <div className="agent-shell-root paper-bg" style={{ minHeight: "100vh", padding: "40px 0" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>
          Approval card preview
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginBottom: 28 }}>
          Mocked — no backend. Click Approve / Decline to walk each state.
        </p>

        <Scenario
          title="Approve → sends successfully"
          approval={{ ...base, id: "ok", status: "pending" }}
          submit={mockSubmit("executed")}
        />
        <Scenario
          title="Approve → fails (Gmail not connected)"
          approval={{ ...base, id: "fail", status: "pending" }}
          submit={mockSubmit("failed", "Gmail isn't connected. Connect Gmail in Settings → Apps to send email.")}
        />
        <Scenario
          title="Already declined (terminal state)"
          approval={{ ...base, id: "declined", status: "declined" }}
          submit={mockSubmit("executed")}
        />
        <Scenario
          title="Already sent (terminal state)"
          approval={{ ...base, id: "executed", status: "executed" }}
          submit={mockSubmit("executed")}
        />
      </div>
    </div>
  );
}
