"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Mail, ShieldAlert, X } from "lucide-react";
import type { ApprovalRisk, ApprovalStatus, ApprovalView } from "@/lib/agent/approvals/types";

const RISK_STYLE: Record<ApprovalRisk, { label: string; color: string; bg: string }> = {
  low: { label: "Low risk", color: "var(--green)", bg: "rgba(22,163,74,0.10)" },
  medium: { label: "Needs review", color: "#b45309", bg: "rgba(180,83,9,0.10)" },
  high: { label: "High impact", color: "var(--red)", bg: "rgba(220,38,38,0.10)" },
};

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return [];
}

function EmailPreview({ preview }: { preview: Record<string, unknown> }) {
  const to = asStringList(preview.to);
  const subject = typeof preview.subject === "string" ? preview.subject : "";
  const body = typeof preview.body === "string" ? preview.body : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Field label="To" value={to.join(", ")} />
      <Field label="Subject" value={subject} />
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Body
        </div>
        <div
          className="selectable"
          style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)", whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13.5 }}>
      <span style={{ flexShrink: 0, minWidth: 58, fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.03em", paddingTop: 2 }}>
        {label}
      </span>
      <span style={{ color: "var(--ink)", wordBreak: "break-word" }}>{value || "—"}</span>
    </div>
  );
}

function GenericPreview({ preview }: { preview: Record<string, unknown> }) {
  const entries = Object.entries(preview);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map(([k, v]) => (
        <Field key={k} label={k} value={typeof v === "string" ? v : JSON.stringify(v)} />
      ))}
    </div>
  );
}

/** Send a decision to the approvals API. Injectable so the card can be tested
 *  (or previewed) with a mock instead of a live request. */
export type DecideFn = (id: string, decision: "approve" | "decline") => Promise<ApprovalView>;

const defaultDecide: DecideFn = async (id, decision) => {
  const res = await fetch(`/api/agent/approvals/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  const data = (await res.json().catch(() => ({}))) as { approval?: ApprovalView; error?: string };
  if (!data.approval) throw new Error(data.error || "Request failed");
  return data.approval;
};

export function AgentApprovalCard({
  approval,
  submit = defaultDecide,
}: {
  approval: ApprovalView;
  submit?: DecideFn;
}) {
  const [status, setStatus] = useState<ApprovalStatus>(approval.status);
  const [error, setError] = useState<string | null>(approval.error ?? null);
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);

  const risk = RISK_STYLE[approval.riskLevel];
  const isEmail = approval.actionType === "send_email";
  const approveLabel = isEmail ? "Approve & send" : "Approve";
  const decided = status !== "pending";

  async function decide(decision: "approve" | "decline") {
    if (busy || decided) return;
    setBusy(decision);
    setError(null);
    try {
      const next = await submit(approval.id, decision);
      setStatus(next.status);
      setError(next.error ?? null);
      if (next.status === "executed") toast.success(isEmail ? "Email sent" : "Action completed");
      else if (next.status === "declined") toast("Declined");
      else if (next.status === "failed") toast.error(next.error || "Action failed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  // Terminal banner shown in place of the action buttons once decided.
  const banner = (() => {
    if (status === "executed")
      return { color: "var(--green)", icon: <Check style={{ width: 15, height: 15 }} />, text: isEmail ? "Approved · email sent" : "Approved · done" };
    if (status === "approved")
      return { color: "var(--green)", icon: <Check style={{ width: 15, height: 15 }} />, text: "Approved" };
    if (status === "declined")
      return { color: "var(--ink-3)", icon: <X style={{ width: 15, height: 15 }} />, text: "Declined" };
    if (status === "failed")
      return { color: "var(--red)", icon: <ShieldAlert style={{ width: 15, height: 15 }} />, text: error || "Action failed" };
    return null;
  })();

  return (
    <div className="card" style={{ margin: "14px 0 0", padding: 14, borderRadius: "var(--r-card)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, background: "var(--blue-bg)", color: "var(--blue)", flexShrink: 0 }}>
          {isEmail ? <Mail style={{ width: 15, height: 15 }} /> : <ShieldAlert style={{ width: 15, height: 15 }} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {approval.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {approval.actionLabel} · approval required
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, color: risk.color, background: risk.bg }}>
          {risk.label}
        </span>
      </div>

      {approval.summary && (
        <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 10 }}>{approval.summary}</div>
      )}

      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
        {isEmail ? <EmailPreview preview={approval.preview} /> : <GenericPreview preview={approval.preview} />}
      </div>

      {/* footer: actions while pending, terminal banner once decided */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        {decided && banner ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: banner.color }}>
            {banner.icon}
            {banner.text}
          </span>
        ) : (
          <>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => decide("approve")}>
              {busy === "approve" ? "Sending…" : approveLabel}
            </button>
            <button className="btn btn-outline" disabled={!!busy} onClick={() => decide("decline")}>
              {busy === "decline" ? "Declining…" : "Decline"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
