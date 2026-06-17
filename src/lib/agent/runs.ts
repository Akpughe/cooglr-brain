// Resilient persistence for the agent shell (migration 024 tables).
//
// IMPORTANT: migration 024 may NOT be applied to the live DB yet. Every call
// here is wrapped so a missing table or any DB error NEVER throws to the
// caller — it logs once and returns null/undefined. The agent must run even
// when persistence is unavailable.

import { createServiceClient } from "@/lib/supabase/server";

type Json = Record<string, unknown> | unknown[] | null;
type RunStatus = "running" | "done" | "error";
type MessageRole = "user" | "assistant" | "system";

let warned = false;
// Log the first DB failure, then stay quiet so we don't spam logs per request.
function warnOnce(where: string, error: unknown) {
  if (warned) return;
  warned = true;
  console.warn(`[agent/runs] persistence unavailable (${where}):`, error);
}

// Run an operation, swallowing any error into a null result.
async function safe<T>(where: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    warnOnce(where, error);
    return null;
  }
}

// Ensure a thread exists; returns its id (existing threadId or a new one).
export async function ensureThread(opts: {
  workspaceId: string;
  userId: string;
  threadId?: string;
  title?: string;
}): Promise<string | null> {
  return safe("ensureThread", async () => {
    const supabase = await createServiceClient();
    if (opts.threadId) {
      await supabase
        .from("agent_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", opts.threadId);
      return opts.threadId;
    }
    const { data, error } = await supabase
      .from("agent_threads")
      .insert({
        workspace_id: opts.workspaceId,
        user_id: opts.userId,
        title: opts.title ?? "New chat",
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data?.id as string) ?? null;
  });
}

// Open a run row; returns its id.
export async function startRun(opts: {
  threadId: string;
  workspaceId: string;
  userId: string;
  input: string;
  modelProfile: string;
}): Promise<string | null> {
  return safe("startRun", async () => {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        thread_id: opts.threadId,
        workspace_id: opts.workspaceId,
        user_id: opts.userId,
        input: opts.input,
        model_profile: opts.modelProfile,
        status: "running",
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data?.id as string) ?? null;
  });
}

// Close out a run with a terminal status.
export async function finishRun(opts: {
  runId: string;
  status: RunStatus;
  modelUsed?: string;
  error?: string;
}): Promise<void> {
  await safe("finishRun", async () => {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("agent_runs")
      .update({
        status: opts.status,
        model_used: opts.modelUsed ?? null,
        error: opts.error ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", opts.runId);
    if (error) throw error;
  });
}

// Persist a chat message (user/assistant/system) on a thread.
export async function saveMessage(opts: {
  threadId: string;
  workspaceId: string;
  runId?: string;
  role: MessageRole;
  content: string;
  parts?: Json;
}): Promise<string | null> {
  return safe("saveMessage", async () => {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("agent_messages")
      .insert({
        thread_id: opts.threadId,
        workspace_id: opts.workspaceId,
        run_id: opts.runId ?? null,
        role: opts.role,
        content: opts.content,
        parts: opts.parts ?? [],
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data?.id as string) ?? null;
  });
}

// Record a single step (tool/reasoning/message) within a run.
export async function recordStep(opts: {
  runId: string;
  workspaceId: string;
  stepIndex: number;
  type: string;
  name?: string;
  input?: Json;
  output?: Json;
}): Promise<void> {
  await safe("recordStep", async () => {
    const supabase = await createServiceClient();
    const { error } = await supabase.from("agent_steps").insert({
      run_id: opts.runId,
      workspace_id: opts.workspaceId,
      step_index: opts.stepIndex,
      type: opts.type,
      name: opts.name ?? null,
      input: opts.input ?? null,
      output: opts.output ?? null,
    });
    if (error) throw error;
  });
}
