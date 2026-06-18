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
import { execAction, unwrap, resolveConnectedToolkits } from "@/lib/composio/actions";
import type { ApprovalRisk } from "./types";

export interface ExecutorContext {
  workspaceId: string;
  /** The user who clicked Approve (POST /api/agent/approvals/[id]). */
  userId: string;
  /** The user whose agent run drafted the action — whose connected account the
   *  side-effect runs against. The approvals route enforces requester === approver
   *  before execute, so this equals `userId` in practice; the side-effect uses it
   *  explicitly so the action always runs from the drafter's connection. */
  requestedBy: string;
}

export interface ApprovalExecutor<P = unknown> {
  actionType: string;
  /** Friendly label, e.g. "Send email". Surfaced to the UI. */
  label: string;
  /** Description shown to the model as the generated tool's description. */
  description: string;
  /** Composio toolkit this action needs connected, e.g. "gmail". null = none. */
  toolkit: string | null;
  defaultRisk: ApprovalRisk;
  schema: z.ZodType<P>;
  /** Card title derived from the payload; falls back to `label`. */
  title?: (payload: P) => string;
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

// Email bodies are sent as plain text — strip Markdown the model may emit so
// the recipient (and the approval card) never sees literal **, __, #, or
// [text](url) syntax. Applied via the schema so the preview and the send agree.
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/__(.+?)__/g, "$1") // __bold__
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // # headings
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)") // [text](url)
    .trim();
}

// ---------- send_email (Gmail via Composio) ----------
const sendEmailSchema = z.object({
  to: z
    .union([z.string().email(), z.array(z.string().email()).min(1)])
    .transform((v) => (Array.isArray(v) ? v : [v])),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).transform(stripMarkdown),
});
type SendEmailPayload = z.infer<typeof sendEmailSchema>;

const sendEmail: ApprovalExecutor<SendEmailPayload> = {
  actionType: "send_email",
  label: "Send email",
  description:
    "Send an email from the user's connected Gmail. Provide the recipient(s) in `to`, " +
    "a `subject`, and the `body` as plain text. This does NOT send immediately — it drafts " +
    "the email and queues it for the user to approve; after calling it, tell the user the " +
    "email is awaiting their approval and never claim it was sent.",
  toolkit: "gmail",
  defaultRisk: "high",
  schema: sendEmailSchema,
  title: (p) => (p.subject ? `Email: ${p.subject}` : "Send email"),
  preview: (p) => ({ to: p.to, subject: p.subject, body: p.body }),
  execute: async (ctx, p) => {
    const sender = ctx.requestedBy; // route guarantees requester === approver

    if (dryRunEnabled()) {
      return { sent: false, dryRun: true, to: p.to, subject: p.subject };
    }

    // Backstop: the sender should have a Gmail connection. Use the cached
    // resolver (not a live call) so a transient Composio blip doesn't fail an
    // approved send as "not connected"; it also honours AGENT_FAKE_CONNECTED.
    const connected = await resolveConnectedToolkits(sender);
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

// ---------- reply (Gmail reply-in-thread via Composio) ----------
const replyEmailSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1).transform(stripMarkdown),
});
type ReplyEmailPayload = z.infer<typeof replyEmailSchema>;

const replyEmail: ApprovalExecutor<ReplyEmailPayload> = {
  actionType: "reply",
  label: "Reply in thread",
  description:
    "Reply within an existing Gmail thread. Provide the `threadId` (from gmail_search " +
    "or gmail_read_thread) and the reply `body` as plain text. This does NOT send " +
    "immediately — it drafts the reply and queues it for the user to approve; after " +
    "calling it, tell the user the reply is awaiting their approval and never claim it was sent.",
  toolkit: "gmail",
  defaultRisk: "high",
  schema: replyEmailSchema,
  title: () => "Reply in thread",
  preview: (p) => ({ threadId: p.threadId, body: p.body }),
  execute: async (ctx, p) => {
    const sender = ctx.requestedBy; // route guarantees requester === approver
    if (dryRunEnabled()) {
      return { sent: false, dryRun: true, threadId: p.threadId };
    }
    const connected = await resolveConnectedToolkits(sender);
    if (!connected.includes("gmail")) {
      throw new Error("Gmail isn't connected. Connect Gmail in Settings → Apps to reply.");
    }
    // Composio GMAIL_REPLY_TO_THREAD: arg shape unverified — confirm live.
    const res = unwrap(
      await execAction("GMAIL_REPLY_TO_THREAD", sender, {
        thread_id: p.threadId,
        message_body: p.body,
        is_html: false,
      }),
    );
    const messageId =
      (res as { id?: string; messageId?: string } | null)?.id ??
      (res as { messageId?: string } | null)?.messageId ??
      null;
    return { sent: true, messageId, threadId: p.threadId };
  },
};

// ---------- registry ----------
const EXECUTORS: Record<string, ApprovalExecutor> = {
  [sendEmail.actionType]: sendEmail as ApprovalExecutor,
  [replyEmail.actionType]: replyEmail as ApprovalExecutor,
};

export function getExecutor(actionType: string): ApprovalExecutor | null {
  return EXECUTORS[actionType] ?? null;
}

export function listActionTypes(): string[] {
  return Object.keys(EXECUTORS);
}

export function listExecutors(): ApprovalExecutor[] {
  return Object.values(EXECUTORS);
}

/** The model-facing tool name for an action, namespaced by toolkit so the model
 *  groups related actions: gmail_send_email, github_create_issue, … */
export function toolNameFor(entry: ApprovalExecutor): string {
  return entry.toolkit ? `${entry.toolkit}_${entry.actionType}` : entry.actionType;
}

/** Actions available to a user given their connected toolkits. An action with a
 *  null toolkit is always available; otherwise its toolkit must be connected. */
export function availableActions(connectedToolkits: string[]): ApprovalExecutor[] {
  const connected = new Set(connectedToolkits);
  return listExecutors().filter((e) => e.toolkit === null || connected.has(e.toolkit));
}
