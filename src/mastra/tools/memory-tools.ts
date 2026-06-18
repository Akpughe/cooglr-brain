// Memory tools — the agent's durable recall/remember across conversations.
//
// Backed by UltraMem. Identity (workspace/user) ALWAYS comes from the trusted
// RequestContext via scopes.ts — never from the model — so the agent can't read
// or write another user's or workspace's memory.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ultramem } from "@/lib/memory/ultramem-client";
import { scopes } from "@/lib/memory/scopes";
import { readContext } from "../context/request-context";

/**
 * save_memory — persist a durable fact, preference, or decision so it's
 * available in future conversations. Default scope is the user's personal
 * memory; "workspace" shares it with the whole team.
 */
export const saveMemory = createTool({
  id: "save_memory",
  description:
    "Persist a durable fact, preference, or decision to memory so it's available " +
    "in future conversations. Use when the user states something worth remembering " +
    "(a preference like 'always answer in Spanish', a fact about their business, a " +
    "decision, or who someone is). Phrase it as a clear standalone statement. " +
    "Default scope is the user's personal memory; use 'workspace' for facts the " +
    "whole team should share.",
  inputSchema: z.object({
    content: z
      .string()
      .describe("The fact/preference/decision to remember, as a clear standalone statement."),
    scope: z
      .enum(["user", "workspace"])
      .default("user")
      .describe("'user' = personal memory; 'workspace' = shared with the team."),
  }),
  outputSchema: z.object({ saved: z.boolean(), scope: z.string(), id: z.string().nullable() }),
  execute: async ({ content, scope }, context) => {
    const { workspaceId, userId } = readContext(context);
    const scopeVal: "user" | "workspace" = scope ?? "user";
    const text = content.trim();
    if (!text) return { saved: false, scope: scopeVal, id: null };

    const containerTag =
      scopeVal === "workspace"
        ? scopes.workspace(workspaceId)
        : scopes.workspaceUser(workspaceId, userId);

    try {
      const res = await ultramem.addMemory({
        content: text,
        source: "memory",
        title: text.length > 80 ? text.slice(0, 77) + "…" : text,
        containerTag,
      });
      return { saved: true, scope: scopeVal, id: res.documentId || null };
    } catch (err) {
      console.error("[save_memory] failed", err);
      return { saved: false, scope: scopeVal, id: null };
    }
  },
});

/**
 * recall_memory — search the user's personal memory for relevant facts,
 * preferences, or decisions from prior conversations. (Workspace documents and
 * shared knowledge are handled by ask_workspace_knowledge.)
 */
export const recallMemory = createTool({
  id: "recall_memory",
  description:
    "Search the user's personal memory for relevant facts, preferences, or " +
    "decisions saved in prior conversations. Call this before answering when the " +
    "question might depend on something the user told you earlier (their " +
    "preferences, prior decisions, who's who). Returns short remembered statements.",
  inputSchema: z.object({
    query: z.string().describe("What to recall — the topic or question."),
  }),
  outputSchema: z.object({ memories: z.array(z.string()) }),
  execute: async ({ query }, context) => {
    const { workspaceId, userId } = readContext(context);
    const tag = scopes.workspaceUser(workspaceId, userId);
    try {
      const res = await ultramem.search({ query, containerTag: tag, limit: 8 });
      const memories = [...res.memories, ...res.documents.flatMap((d) => d.snippets.map((s) => s.text))];
      return { memories: [...new Set(memories.map((m) => m.trim()).filter(Boolean))].slice(0, 10) };
    } catch (err) {
      console.error("[recall_memory] failed", err);
      return { memories: [] };
    }
  },
});
