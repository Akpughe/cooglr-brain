// Resilient persistence for approval_requests (migration 026).
//
// Like src/lib/agent/runs.ts, migration 026 may NOT be applied to the live DB
// yet. Every call is wrapped so a missing table or any DB error NEVER throws to
// the caller — it logs once and returns null. The agent must run even when
// approvals persistence is unavailable (it just won't offer an approve button).

import { createServiceClient } from "@/lib/supabase/server";
import type { ApprovalRisk, ApprovalStatus } from "./types";

export interface ApprovalRow {
  id: string;
  workspace_id: string;
  thread_id: string | null;
  run_id: string | null;
  requested_by: string;
  action_type: string;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  preview: Record<string, unknown>;
  sources: unknown[];
  risk_level: ApprovalRisk;
  status: ApprovalStatus;
  decided_by: string | null;
  error: string | null;
}

let warned = false;
function warnOnce(where: string, error: unknown) {
  if (warned) return;
  warned = true;
  console.warn(`[agent/approvals] persistence unavailable (${where}):`, error);
}

async function safe<T>(where: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    warnOnce(where, error);
    return null;
  }
}

const SELECT =
  "id, workspace_id, thread_id, run_id, requested_by, action_type, title, summary, payload, preview, sources, risk_level, status, decided_by, error";

// Create a pending approval request; returns its id (or null if persistence
// is unavailable — the caller then declines to offer an approve button).
export async function createApprovalRequest(opts: {
  workspaceId: string;
  userId: string;
  threadId?: string | null;
  runId?: string | null;
  actionType: string;
  title: string;
  summary?: string | null;
  payload: Record<string, unknown>;
  preview: Record<string, unknown>;
  sources?: unknown[];
  riskLevel: ApprovalRisk;
}): Promise<string | null> {
  return safe("createApprovalRequest", async () => {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        workspace_id: opts.workspaceId,
        thread_id: opts.threadId ?? null,
        run_id: opts.runId ?? null,
        requested_by: opts.userId,
        action_type: opts.actionType,
        title: opts.title,
        summary: opts.summary ?? null,
        payload: opts.payload,
        preview: opts.preview,
        sources: opts.sources ?? [],
        risk_level: opts.riskLevel,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data?.id as string) ?? null;
  });
}

// Load one request (no membership check — the API route authorises).
export async function getApprovalRequest(id: string): Promise<ApprovalRow | null> {
  return safe("getApprovalRequest", async () => {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("approval_requests")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as ApprovalRow) ?? null;
  });
}

// Atomically transition pending -> approved|declined. Returns the row only if
// THIS call performed the transition (guards against double-decide / -execute);
// returns null if it was already decided or persistence is unavailable.
export async function decideApprovalRequest(opts: {
  id: string;
  decision: "approved" | "declined";
  decidedBy: string;
}): Promise<ApprovalRow | null> {
  return safe("decideApprovalRequest", async () => {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("approval_requests")
      .update({
        status: opts.decision,
        decided_by: opts.decidedBy,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.id)
      .eq("status", "pending")
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    return (data as ApprovalRow) ?? null;
  });
}

// Mark an approved request executed (success) with the executor result.
export async function markExecuted(id: string, result: Record<string, unknown>): Promise<void> {
  await safe("markExecuted", async () => {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: "executed",
        result,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  });
}

// Mark an approved request failed (the side-effect threw).
export async function markFailed(id: string, message: string): Promise<void> {
  await safe("markFailed", async () => {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  });
}
