// Action tools — the agent's gated, outward-facing actions (send email, …).
//
// Each tool is GENERATED from an entry in the approval executor registry, so the
// registry stays the single source of truth while the model sees a named, typed
// tool (e.g. gmail_send_email(to, subject, body)) rather than one opaque generic
// tool. Calling a tool never performs the action: it validates the input,
// persists a PENDING approval_requests row, and returns a reference. The real
// side-effect runs later, only when the requester approves it via
// POST /api/agent/approvals/[id]. (Roadmap §4.12 / guardrail §9.4.)
//
// Tools are attached per run, filtered to the user's connected toolkits, so the
// model is only ever offered actions it can actually take. Identity comes from
// the trusted RequestContext, never the model.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readContext } from "../context/request-context";
import {
  availableActions,
  toolNameFor,
  type ApprovalExecutor,
} from "@/lib/agent/approvals/executors";
import { createApprovalRequest } from "@/lib/agent/approvals/store";
import type { ApprovalView } from "@/lib/agent/approvals/types";

const APPROVAL_OUTPUT = z.object({
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
});

// Build a Mastra tool from a registry entry. The tool's input schema IS the
// entry's typed schema, so the model fills real, validated fields.
export function makeActionTool(entry: ApprovalExecutor) {
  return createTool({
    id: toolNameFor(entry),
    description: entry.description,
    inputSchema: entry.schema,
    outputSchema: APPROVAL_OUTPUT,
    execute: async (input, context) => {
      const { workspaceId, userId } = readContext(context);

      // Mastra has already validated `input` against inputSchema; re-parse to
      // get the normalised value (and stay safe if called directly).
      const parsed = entry.schema.safeParse(input);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const where = issue?.path?.join(".") || "input";
        return { approval: null, error: `Invalid input (${where}): ${issue?.message ?? "validation failed"}.` };
      }

      const payload = parsed.data as Record<string, unknown>;
      const title = entry.title?.(parsed.data) ?? entry.label;
      const preview = entry.preview(parsed.data);

      const id = await createApprovalRequest({
        workspaceId,
        userId,
        actionType: entry.actionType,
        title,
        summary: null,
        payload,
        preview,
        riskLevel: entry.defaultRisk,
      });
      if (!id) {
        return { approval: null, error: "Approvals aren't available right now (storage unavailable)." };
      }

      const view: ApprovalView = {
        id,
        actionType: entry.actionType,
        actionLabel: entry.label,
        title,
        summary: null,
        riskLevel: entry.defaultRisk,
        status: "pending",
        preview,
      };
      return { approval: view, error: null };
    },
  });
}

// The action tools available for a given set of connected toolkits, keyed by
// model-facing tool name. Attached to the agent per run.
export function buildActionTools(connectedToolkits: string[]): Record<string, ReturnType<typeof makeActionTool>> {
  const tools: Record<string, ReturnType<typeof makeActionTool>> = {};
  for (const entry of availableActions(connectedToolkits)) {
    tools[toolNameFor(entry)] = makeActionTool(entry);
  }
  return tools;
}
