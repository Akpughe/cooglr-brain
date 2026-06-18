// Read tools — the agent's source-perception layer (Gmail/Slack/GitHub/Drive).
//
// Generated from a small registry, like the action tools, but a DIFFERENT
// category: reads return data to the model directly and are NOT approval-gated
// (reading the acting user's own connected source is not an outward action).
// They ARE connection-gated (attached per run only for connected toolkits) and
// identity-bound — the acting user comes from the trusted RequestContext.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readContext } from "../context/request-context";
import {
  gmailSearch,
  gmailReadThread,
  slackListChannels,
  slackReadChannel,
  githubListIssues,
  driveSearch,
  driveReadFile,
  type ReadItem,
} from "@/lib/composio/reads";

interface ReadToolEntry {
  name: string; // model-facing tool name
  toolkit: string; // Composio toolkit that must be connected
  source: string; // citation source label key (gmail | slack | github | google-drive)
  description: string;
  inputSchema: z.ZodType;
  run: (userId: string, input: Record<string, unknown>) => Promise<ReadItem[]>;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

const READ_TOOLS: ReadToolEntry[] = [
  {
    name: "gmail_search",
    toolkit: "gmail",
    source: "gmail",
    description:
      "Search the user's WHOLE Gmail mailbox (no date limit). `query` uses Gmail search syntax. " +
      "Returns ALL matches up to ~120, each with sender, recipient, date, subject and a snippet — " +
      "so you can thoroughly enumerate who was contacted. For 'everyone/all X' questions use a " +
      "BROAD query (the topic word alone, or 'from:me <topic>' for mail the user sent); do NOT " +
      "narrow prematurely or stop at the first few — enumerate from the full result set and dedupe " +
      "by person/organisation.",
    inputSchema: z.object({ query: z.string().describe("Gmail search query, e.g. 'Nuton' or 'from:me Nuton'.") }),
    run: (userId, input) => gmailSearch(userId, str(input.query)),
  },
  {
    name: "gmail_read_thread",
    toolkit: "gmail",
    source: "gmail",
    description: "Read all messages in one Gmail thread (use the threadId from gmail_search) to get full context before drafting a reply.",
    inputSchema: z.object({ threadId: z.string().describe("The Gmail threadId to read.") }),
    run: (userId, input) => gmailReadThread(userId, str(input.threadId)),
  },
  {
    name: "slack_list_channels",
    toolkit: "slack",
    source: "slack",
    description: "List the user's Slack channels (to find a channel id before reading it).",
    inputSchema: z.object({}),
    run: (userId) => slackListChannels(userId),
  },
  {
    name: "slack_read_channel",
    toolkit: "slack",
    source: "slack",
    description: "Read recent messages from a Slack channel (use the channel id from slack_list_channels).",
    inputSchema: z.object({ channel: z.string().describe("The Slack channel id.") }),
    run: (userId, input) => slackReadChannel(userId, str(input.channel)),
  },
  {
    name: "github_list_issues",
    toolkit: "github",
    source: "github",
    description: "List issues in a GitHub repository.",
    inputSchema: z.object({ owner: z.string().describe("Repo owner/org."), repo: z.string().describe("Repo name.") }),
    run: (userId, input) => githubListIssues(userId, str(input.owner), str(input.repo)),
  },
  {
    name: "drive_search",
    toolkit: "google-drive",
    source: "google-drive",
    description: "Search the user's Google Drive by file name.",
    inputSchema: z.object({ query: z.string().describe("Text to match in the file name.") }),
    run: (userId, input) => driveSearch(userId, str(input.query)),
  },
  {
    name: "drive_read_file",
    toolkit: "google-drive",
    source: "google-drive",
    description: "Read the text content of a Google Drive file (use the fileId from drive_search).",
    inputSchema: z.object({ fileId: z.string().describe("The Drive fileId.") }),
    run: (userId, input) => driveReadFile(userId, str(input.fileId)),
  },
];

const READ_OUTPUT = z.object({
  source: z.string(),
  count: z.number(),
  items: z.array(z.object({ id: z.string(), title: z.string(), text: z.string(), ref: z.string() })),
  markdown: z.string(),
  citations: z.array(z.object({ fileId: z.string(), score: z.number(), title: z.string(), source: z.string() })),
});

function makeReadTool(entry: ReadToolEntry) {
  return createTool({
    id: entry.name,
    description: entry.description,
    inputSchema: entry.inputSchema,
    outputSchema: READ_OUTPUT,
    execute: async (input, context) => {
      const { userId } = readContext(context);
      let items: ReadItem[] = [];
      try {
        items = await entry.run(userId, (input ?? {}) as Record<string, unknown>);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "read failed";
        return { source: entry.source, count: 0, items: [], markdown: `Couldn't read ${entry.source}: ${msg}`, citations: [] };
      }
      // Lean index (title + first meta line) — items[] carries the full detail.
      // Keeps large result sets (e.g. a 120-result Gmail sweep) affordable.
      const markdown = items.length
        ? items.map((it, i) => `${i + 1}. ${it.title}${it.text ? ` — ${it.text.split("\n")[0].slice(0, 160)}` : ""}`).join("\n")
        : `No ${entry.source} results.`;
      const citations = items.map((it) => ({ fileId: it.ref, score: 1, title: it.title, source: entry.source }));
      return { source: entry.source, count: items.length, items, markdown, citations };
    },
  });
}

/** Read tools for the user's connected toolkits, keyed by tool name. Attached
 *  to the agent per run alongside the (approval-gated) action tools. */
export function buildReadTools(connectedToolkits: string[]): Record<string, ReturnType<typeof makeReadTool>> {
  const connected = new Set(connectedToolkits);
  const tools: Record<string, ReturnType<typeof makeReadTool>> = {};
  for (const entry of READ_TOOLS) {
    if (connected.has(entry.toolkit)) tools[entry.name] = makeReadTool(entry);
  }
  return tools;
}

/** Names of the read tools available for the connected toolkits — for the
 *  agent's per-run instructions. */
export function availableReadToolNames(connectedToolkits: string[]): string[] {
  const connected = new Set(connectedToolkits);
  return READ_TOOLS.filter((e) => connected.has(e.toolkit)).map((e) => e.name);
}
