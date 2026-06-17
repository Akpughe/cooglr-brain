// Knowledge tools — the agent's bridge to the workspace data brain.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { runUnifiedQuery } from "@/lib/knowledge/router";
import { readContext } from "../context/request-context";

// Cap stored markdown so a runaway answer can't blow up payloads/UI.
const MAX_MARKDOWN = 24_000;

/**
 * ask_workspace_knowledge — the source-grounded truth tool.
 *
 * This is the ONLY way the agent should answer questions about the workspace's
 * own data, documents, metrics or connected sources. It runs the unified
 * knowledge router (connected database + ingested document corpus) and returns
 * a grounded answer with citations. Identity (workspace/user) comes from the
 * trusted RequestContext, never from the model — so the model cannot point this
 * tool at another workspace.
 */
export const askWorkspaceKnowledge = createTool({
  id: "ask_workspace_knowledge",
  description:
    "Answer a question grounded in this workspace's connected database and " +
    "ingested documents. Returns a markdown answer with citations (and a chart " +
    "when the data supports one). Use this for anything about the workspace's " +
    "data, documents, metrics, records or files — it is the source of truth.",
  inputSchema: z.object({
    question: z.string().describe("The natural-language question to answer."),
  }),
  outputSchema: z.object({
    source: z.enum(["database", "content"]),
    markdown: z.string(),
    citations: z.array(
      z.object({
        fileId: z.string(),
        score: z.number(),
        title: z.string().optional(),
        source: z.string().optional(),
      }),
    ),
    sql: z.string().nullable(),
    hasChart: z.boolean(),
    chart: z.any().optional(),
    hasTable: z.boolean(),
    table: z.any().optional(),
    origins: z.array(z.string()),
  }),
  execute: async ({ question }, context) => {
    const { workspaceId, userId, focusFileIds } = readContext(context);
    const supabase = await createServiceClient();
    const ans = await runUnifiedQuery(supabase, { workspaceId, question, userId, focusFileIds });

    const markdown =
      ans.answerMd.length > MAX_MARKDOWN
        ? ans.answerMd.slice(0, MAX_MARKDOWN) + "\n\n…(truncated)"
        : ans.answerMd;

    return {
      source: ans.source,
      markdown,
      citations: ans.citations ?? [],
      sql: ans.sql ?? null,
      hasChart: Boolean(ans.chart),
      chart: ans.chart,
      hasTable: Boolean(ans.table),
      table: ans.table,
      origins: ans.origins ?? [],
    };
  },
});
