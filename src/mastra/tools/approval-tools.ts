// request_approval — the agent's gate for actions that must not happen silently
// (sending email, bulk mutations, …). Instead of performing the action, the
// agent calls this tool: it validates the action against the server-side
// executor registry, persists a PENDING approval_requests row, and returns a
// reference. The real side-effect runs later, only when a member approves via
// POST /api/agent/approvals/[id]. (Roadmap §4.12 / guardrail §9.4.)
//
// Identity (workspace/user) ALWAYS comes from the trusted RequestContext —
// never from the model — so the agent can't request actions in another
// workspace. The thread/run linkage is read from context too where present.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readContext } from "../context/request-context";
import { getExecutor, listActionTypes } from "@/lib/agent/approvals/executors";
import { createApprovalRequest } from "@/lib/agent/approvals/store";
import type { ApprovalView } from "@/lib/agent/approvals/types";

export const requestApproval = createTool({
  id: "request_approval",
  description:
    "Request human approval before performing an external or high-impact action " +
    "(e.g. sending an email). NEVER claim such an action was done — instead draft " +
    "it and call this tool, which queues it for the user to approve or decline. " +
    `Available actions: ${listActionTypes().join(", ")}. ` +
    "For send_email, the payload must be {to, subject, body}. After calling this, " +
    "tell the user you've drafted the action and it needs their approval.",
  inputSchema: z.object({
    actionType: z
      .string()
      .describe(`The action to perform. One of: ${listActionTypes().join(", ")}.`),
    title: z
      .string()
      .describe("Short human title for the approval card, e.g. 'Send launch update email'."),
    summary: z
      .string()
      .optional()
      .describe("One-line description of what will happen if approved."),
    payload: z
      .record(z.string(), z.unknown())
      .describe("The action's input. For send_email: {to, subject, body}."),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
  }),
  outputSchema: z.object({
    approval: z
      .object({
        id: z.string(),
        actionType: z.string(),
        actionLabel: z.string(),
        title: z.string(),
        summary: z.string().nullable(),
        riskLevel: z.enum(["low", "medium", "high"]),
        status: z.enum(["pending", "approved", "declined", "executed", "failed"]),
        preview: z.record(z.string(), z.unknown()),
      })
      .nullable(),
    error: z.string().nullable(),
  }),
  execute: async ({ actionType, title, summary, payload, riskLevel }, context) => {
    const { workspaceId, userId } = readContext(context);

    const executor = getExecutor(actionType);
    if (!executor) {
      return { approval: null, error: `Unknown action "${actionType}". Available: ${listActionTypes().join(", ")}.` };
    }

    // Validate/normalise the payload against the executor's own schema so a
    // malformed draft is rejected here, before anything is queued.
    const parsed = executor.schema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path?.join(".") || "payload";
      return { approval: null, error: `Invalid payload for ${actionType} (${where}): ${issue?.message ?? "validation failed"}.` };
    }

    const risk = riskLevel ?? executor.defaultRisk;
    const preview = executor.preview(parsed.data);

    const id = await createApprovalRequest({
      workspaceId,
      userId,
      actionType,
      title,
      summary: summary ?? null,
      payload: parsed.data as Record<string, unknown>,
      preview,
      riskLevel: risk,
    });

    if (!id) {
      // Persistence unavailable — be honest rather than implying it's queued.
      return { approval: null, error: "Approvals aren't available right now (storage unavailable)." };
    }

    const view: ApprovalView = {
      id,
      actionType,
      actionLabel: executor.label,
      title,
      summary: summary ?? null,
      riskLevel: risk,
      status: "pending",
      preview,
    };
    return { approval: view, error: null };
  },
});
