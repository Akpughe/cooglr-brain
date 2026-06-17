// Shared approval types — safe to import from both server and client.
// (No server-only deps here so the client approval card can reuse them.)

export type ApprovalRisk = "low" | "medium" | "high";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "declined"
  | "executed"
  | "failed";

/** The display-facing shape surfaced to the client (via tool output or the
 *  approvals API). Never carries secrets — `preview` is display-only. */
export interface ApprovalView {
  id: string;
  actionType: string;
  /** Friendly action label from the executor registry, e.g. "Send email". */
  actionLabel: string;
  title: string;
  summary: string | null;
  riskLevel: ApprovalRisk;
  status: ApprovalStatus;
  preview: Record<string, unknown>;
  error?: string | null;
}
