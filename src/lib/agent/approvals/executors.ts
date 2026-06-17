// Approval executor registry — the SERVER-SIDE source of truth for what gated
// actions exist and how they run. The agent can only request an action whose
// `actionType` is registered here; the model never executes side-effects itself.
//
// Each executor declares:
//   - a zod schema that validates/normalises the action payload,
//   - a display-only `preview` (shown in the approval card; carries no secrets),
//   - `execute`, the real side-effect, run ONLY after a member approves.
//
// Actions run through the user's Composio connection (Gmail, GitHub, Slack, …),
// NOT a workspace-level provider — the agent acts on behalf of the person whose
// run drafted it (`requestedBy`). Server-only.

import { z } from "zod";
import { execAction, unwrap } from "@/lib/composio/actions";
import { listConnectedToolkits } from "@/lib/composio/connect";
import type { ApprovalRisk } from "./types";

export interface ExecutorContext {
  workspaceId: string;
  /** The user who clicked Approve (POST /api/agent/approvals/[id]). */
  userId: string;
  /** The user whose agent run drafted the action — whose connected account the
   *  side-effect runs against. Falls back to `userId` when absent. */
  requestedBy: string;
}

export interface ApprovalExecutor<P = unknown> {
  actionType: string;
  /** Friendly label, e.g. "Send email". Surfaced to the UI. */
  label: string;
  /** Composio toolkit this action needs connected, e.g. "gmail". null = none. */
  toolkit: string | null;
  defaultRisk: ApprovalRisk;
  schema: z.ZodType<P>;
  /** Display-only preview derived from the validated payload. No secrets. */
  preview: (payload: P) => Record<string, unknown>;
  /** Perform the real side-effect. Throw on failure; the message is surfaced. */
  execute: (ctx: ExecutorContext, payload: P) => Promise<Record<string, unknown>>;
}

// Dry-run: skip the real Composio call and just echo the payload. Lets the full
// approval loop be tested without a connected account. Explicit opt-in via env.
function dryRunEnabled(): boolean {
  return process.env.AGENT_APPROVALS_DRY_RUN === "true";
}

// ---------- send_email (Gmail via Composio) ----------
const sendEmailSchema = z.object({
  to: z
    .union([z.string().email(), z.array(z.string().email()).min(1)])
    .transform((v) => (Array.isArray(v) ? v : [v])),
  subject: z.string().min(1).max(300),
  body: z.string().min(1),
});
type SendEmailPayload = z.infer<typeof sendEmailSchema>;

const sendEmail: ApprovalExecutor<SendEmailPayload> = {
  actionType: "send_email",
  label: "Send email",
  toolkit: "gmail",
  defaultRisk: "high",
  schema: sendEmailSchema,
  preview: (p) => ({ to: p.to, subject: p.subject, body: p.body }),
  execute: async (ctx, p) => {
    const sender = ctx.requestedBy || ctx.userId;

    if (dryRunEnabled()) {
      return { sent: false, dryRun: true, to: p.to, subject: p.subject };
    }

    // The sender must have a live Gmail connection (Composio handles the OAuth).
    const connected = await listConnectedToolkits(sender);
    if (!connected.includes("gmail")) {
      throw new Error("Gmail isn't connected. Connect Gmail in Settings → Apps to send email.");
    }

    // Composio GMAIL_SEND_EMAIL: one primary recipient + extras. Field names per
    // the Composio Gmail action (verify against a live connection — untestable
    // here). Body is sent as HTML so newlines render.
    const [primary, ...extras] = p.to;
    const res = unwrap(
      await execAction("GMAIL_SEND_EMAIL", sender, {
        recipient_email: primary,
        ...(extras.length ? { extra_recipients: extras } : {}),
        subject: p.subject,
        body: p.body,
        is_html: false,
      }),
    );

    const messageId =
      (res as { id?: string; messageId?: string } | null)?.id ??
      (res as { messageId?: string } | null)?.messageId ??
      null;
    return { sent: true, messageId, to: p.to };
  },
};

// ---------- registry ----------
const EXECUTORS: Record<string, ApprovalExecutor> = {
  [sendEmail.actionType]: sendEmail as ApprovalExecutor,
};

export function getExecutor(actionType: string): ApprovalExecutor | null {
  return EXECUTORS[actionType] ?? null;
}

export function listActionTypes(): string[] {
  return Object.keys(EXECUTORS);
}
