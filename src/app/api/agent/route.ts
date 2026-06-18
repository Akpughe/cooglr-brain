// Chat-first agent endpoint. Streams the Mastra supervisor agent's response as
// an AI SDK UI message stream (consumed by useChat on the client).
//
// Security: the client sends workspaceId/workspaceSlug as hints; we ALWAYS
// verify membership server-side and derive the RequestContext from the
// authenticated session — tools never trust model/client-provided ids.

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { mastra } from "@/mastra";
import { buildRequestContext } from "@/mastra/context/request-context";
import { buildDateSystemNote } from "@/mastra/context/date-note";
import {
  ensureThread,
  startRun,
  finishRun,
  saveMessage,
} from "@/lib/agent/runs";
import { resolveConnectedToolkits } from "@/lib/composio/actions";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toAISdkStream } from "@mastra/ai-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  messages: unknown[];
  threadId?: string;
  modelProfile?: string;
  workspaceId?: string;
  workspaceSlug?: string;
  /** File ids the user @-referenced in this turn (hard-pins retrieval). */
  focusFileIds?: string[];
};

type UIPart = { type?: string; text?: string };
type UIMessageLike = { role?: string; parts?: UIPart[]; content?: string };

function textOf(msg: UIMessageLike | undefined): string {
  if (!msg) return "";
  const fromParts = (msg.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
  return fromParts || msg.content || "";
}

// Resolve the authenticated actor, or a dev seed when AGENT_DEV_NO_AUTH=true
// (test-only; never honoured in production). Returns null when unauthorized.
async function resolveActor(workspaceSlug?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { userId: user.id };

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.AGENT_DEV_NO_AUTH === "true"
  ) {
    if (process.env.AGENT_DEV_USER_ID) {
      return { userId: process.env.AGENT_DEV_USER_ID };
    }
    if (workspaceSlug) {
      const svc = await createServiceClient();
      const { data: ws } = await svc
        .from("workspaces")
        .select("owner_id")
        .eq("slug", workspaceSlug)
        .maybeSingle();
      if (ws?.owner_id) return { userId: ws.owner_id as string };
    }
  }
  return null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { messages, threadId, modelProfile, workspaceId, workspaceSlug, focusFileIds } = body;
  if (!Array.isArray(messages) || !workspaceId) {
    return new Response("messages and workspaceId are required", { status: 400 });
  }

  const actor = await resolveActor(workspaceSlug);
  if (!actor) return new Response("Unauthorized", { status: 401 });

  // Verify membership server-side (the client-provided workspaceId is only a hint).
  const svc = await createServiceClient();
  const { data: membership } = await svc
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (!membership) return new Response("Forbidden", { status: 403 });

  // Workspace persona: owner-set instructions every member's agent follows.
  const { data: ws } = await svc
    .from("workspaces")
    .select("agent_instructions")
    .eq("id", workspaceId)
    .maybeSingle();
  const personaInstructions = (ws?.agent_instructions as string | null)?.trim() || null;
  const dateNote = { role: "system", content: buildDateSystemNote(new Date()) };
  const personaNote = personaInstructions
    ? {
        role: "system",
        content: `Workspace operating instructions (set by the workspace owner — follow these in addition to your core behaviour):\n${personaInstructions}`,
      }
    : null;
  const effectiveMessages = [
    dateNote,
    ...(personaNote ? [personaNote] : []),
    ...(messages as UIMessageLike[]),
  ];

  // Validate any @-referenced file ids actually belong to this workspace, so a
  // client can't pin retrieval to files outside it. Only the surviving ids are
  // trusted into the request context.
  let focusIds: string[] = [];
  if (Array.isArray(focusFileIds) && focusFileIds.length > 0) {
    const requested = [...new Set(focusFileIds.filter((id) => typeof id === "string"))].slice(0, 20);
    if (requested.length > 0) {
      const { data: ownFiles } = await svc
        .from("files")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("id", requested);
      focusIds = (ownFiles ?? []).map((f) => f.id as string);
    }
  }

  // Which toolkits this user has connected (Composio) — gates which action
  // tools the agent is offered this run. Best-effort + cached; never blocks.
  const connectedToolkits = await resolveConnectedToolkits(actor.userId);

  const traceId = crypto.randomUUID();
  const requestContext = buildRequestContext({
    userId: actor.userId,
    workspaceId,
    workspaceSlug: workspaceSlug ?? "",
    role: (membership.role as string) ?? "member",
    traceId,
    focusFileIds: focusIds.length > 0 ? focusIds : undefined,
    connectedToolkits: connectedToolkits.length > 0 ? connectedToolkits : undefined,
  });

  // Best-effort persistence (degrades silently if migration 024 isn't applied yet).
  const lastUserText = textOf(
    [...(messages as UIMessageLike[])].reverse().find((m) => m.role === "user"),
  );
  const activeThreadId =
    (await ensureThread({
      workspaceId,
      userId: actor.userId,
      threadId,
      title: lastUserText ? lastUserText.slice(0, 64) : undefined,
    })) ?? threadId ?? null;

  const runId = activeThreadId
    ? await startRun({
        threadId: activeThreadId,
        workspaceId,
        userId: actor.userId,
        input: lastUserText,
        modelProfile: modelProfile ?? "deep",
      })
    : null;

  if (activeThreadId && lastUserText) {
    await saveMessage({
      threadId: activeThreadId,
      workspaceId,
      runId: runId ?? undefined,
      role: "user",
      content: lastUserText,
    });
  }

  const agent = mastra.getAgent("workspaceSupervisor");

  // Mastra defaults to 5 tool steps per turn — too few for agentic work that
  // reads several sources and THEN drafts/acts (the model can exhaust the budget
  // gathering context and end with no answer). Give it room to read-then-act.
  const AGENT_MAX_STEPS = 16;

  let agentStream: Awaited<ReturnType<typeof agent.stream>>;
  try {
    agentStream = await agent.stream(effectiveMessages as never, { requestContext, maxSteps: AGENT_MAX_STEPS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runId) await finishRun({ runId, status: "error", error: msg });
    return new Response(`Agent failed to start: ${msg}`, { status: 500 });
  }

  const uiStream = createUIMessageStream({
    originalMessages: messages as never,
    execute: ({ writer }) => {
      // Surface the (possibly newly-created) thread id so the client can update
      // its URL/sidebar without a reload.
      if (activeThreadId) {
        writer.write({ type: "data-thread", data: { threadId: activeThreadId }, transient: true } as never);
      }
      writer.merge(toAISdkStream(agentStream, { from: "agent" }) as never);
    },
    onFinish: async ({ responseMessage }) => {
      const assistantText = textOf(responseMessage as UIMessageLike);
      if (activeThreadId && assistantText) {
        await saveMessage({
          threadId: activeThreadId,
          workspaceId,
          runId: runId ?? undefined,
          role: "assistant",
          content: assistantText,
        });
      }
      if (runId) {
        await finishRun({ runId, status: "done", modelUsed: modelProfile ?? "deep" });
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiStream });
}

// Thread history for the active conversation.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get("threadId");
  if (!threadId) return Response.json({ messages: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("agent_messages")
    .select("id, role, content, parts, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ messages: [] });
  return Response.json({ messages: data ?? [] });
}
