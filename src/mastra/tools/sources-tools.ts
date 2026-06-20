// list_workspace_sources — the agent's "eyes" over what's indexed.
//
// Returns a compact catalog of the documents/sources in this workspace so the
// agent can, when a question is vague or a search came back weak, see what
// exists and target the right source — instead of concluding "nothing found".
// Identity (workspace) comes from the trusted RequestContext, never the model.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ultramem, type UltraMemTimelineItem } from "@/lib/memory/ultramem-client";
import { scopes } from "@/lib/memory/scopes";
import { readContext } from "../context/request-context";

// Human label for an origin, mirroring content-query's ORIGIN_LABELS.
const ORIGIN_LABELS: Record<string, string> = {
  gmail: "Gmail",
  slack: "Slack",
  github: "GitHub",
  "google-drive": "Google Drive",
  file: "documents",
  manual: "documents",
  memory: "memory",
};

/** Normalize timeline items into a compact, deduped catalog (pure; unit-tested). */
export function toSourceCatalog(
  items: UltraMemTimelineItem[],
): { title: string; type: string; reference?: string }[] {
  const seen = new Set<string>();
  const out: { title: string; type: string; reference?: string }[] = [];
  for (const it of items) {
    const title = (it.title ?? "").trim() || "Untitled";
    if (seen.has(title)) continue;
    seen.add(title);
    out.push({
      title,
      type: (it.source && ORIGIN_LABELS[it.source]) || "documents",
      reference: it.reference,
    });
  }
  return out;
}

export const listWorkspaceSources = createTool({
  id: "list_workspace_sources",
  description:
    "List the documents and sources indexed in this workspace (titles + type). " +
    "Call this when a question is vague, time-relative ('next 5 days', 'this week', " +
    "'upcoming'), or when ask_workspace_knowledge came back weak/empty — so you can " +
    "see what exists and target the right source before answering or giving up.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    sources: z.array(
      z.object({
        title: z.string(),
        type: z.string(),
        reference: z.string().optional(),
      }),
    ),
  }),
  execute: async (_input, context) => {
    const { workspaceId } = readContext(context);
    try {
      const res = await ultramem.timeline({ containerTag: scopes.workspace(workspaceId), limit: 200 });
      return { sources: toSourceCatalog(res.items) };
    } catch (err) {
      console.error("[list_workspace_sources] failed", err);
      return { sources: [] };
    }
  },
});
