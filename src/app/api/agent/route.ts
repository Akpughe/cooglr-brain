// Chat-first agent endpoint. Streams the Mastra supervisor agent's response as
// an AI SDK UI message stream (consumed by useChat on the client).
//
// Security: the client sends workspaceId/workspaceSlug as hints; we ALWAYS
// verify membership server-side and derive the RequestContext from the
// authenticated session — tools never trust model/client-provided ids.

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { mastra } from "@/mastra";
import { buildRequestContext } from "@/mastra/context/request-context";
import {
  ensureThread,
  startRun,
  finishRun,
  saveMessage,
} from "@/lib/agent/runs";
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

  const { messages, threadId, modelProfile, workspaceId, workspaceSlug } = body;
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

  const traceId = crypto.randomUUID();
  const requestContext = buildRequestContext({
    userId: actor.userId,
    workspaceId,
    workspaceSlug: workspaceSlug ?? "",
    role: (membership.role as string) ?? "member",
    traceId,
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

  let agentStream: Awaited<ReturnType<typeof agent.stream>>;
  try {
    agentStream = await agent.stream(messages as never, { requestContext });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runId) await finishRun({ runId, status: "error", error: msg });
    return new Response(`Agent failed to start: ${msg}`, { status: 500 });
  }

  const uiStream = createUIMessageStream({
    originalMessages: messages as never,
    execute: ({ writer }) => {
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
