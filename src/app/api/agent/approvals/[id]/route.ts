// Approval decisions for the agent shell.
//   GET   — fetch one approval's current state (card hydration / re-open)
//   POST  — { decision: "approve" | "decline" }; on approve, run the action's
//           real side-effect server-side and record the outcome.
//
// Security: like the rest of the agent API, the authenticated user is derived
// from the session and membership is ALWAYS verified server-side with the
// SERVICE client against workspace_members — the approval's workspace_id is
// loaded from the DB, never trusted from the client. The action PAYLOAD is also
// loaded from the DB (not the request body), so a client can't alter what runs.

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  getApprovalRequest,
  decideApprovalRequest,
  markExecuted,
  markFailed,
  type ApprovalRow,
} from "@/lib/agent/approvals/store";
import { getExecutor } from "@/lib/agent/approvals/executors";
import type { ApprovalView } from "@/lib/agent/approvals/types";

// Authenticate, load the approval, and confirm the user is a member of its
// workspace. Returns either an error response or the approval row + user id.
async function authorize(
  id: string,
): Promise<{ error: NextResponse } | { approval: ApprovalRow; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const approval = await getApprovalRequest(id);
  if (!approval) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const svc = await createServiceClient();
  const { data: membership } = await svc
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", approval.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { approval, userId: user.id };
}

// Project a stored row into the client-facing view (drops payload/secrets).
function toView(row: ApprovalRow): ApprovalView {
  const executor = getExecutor(row.action_type);
  return {
    id: row.id,
    actionType: row.action_type,
    actionLabel: executor?.label ?? row.action_type,
    title: row.title,
    summary: row.summary,
    riskLevel: row.risk_level,
    status: row.status,
    preview: row.preview ?? {},
    error: row.error,
  };
}

// GET /api/agent/approvals/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ approval: toView(auth.approval) });
}

// POST /api/agent/approvals/[id]  body: { decision: "approve" | "decline" }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  let body: { decision?: string };
  try {
    body = (await req.json()) as { decision?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const decision = body.decision === "approve" ? "approved" : body.decision === "decline" ? "declined" : null;
  if (!decision) {
    return NextResponse.json({ error: "decision must be 'approve' or 'decline'" }, { status: 400 });
  }

  if (auth.approval.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${auth.approval.status}`, approval: toView(auth.approval) },
      { status: 409 },
    );
  }

  // Atomically claim the pending request so it can't be decided/executed twice.
  const claimed = await decideApprovalRequest({ id, decision, decidedBy: auth.userId });
  if (!claimed) {
    // Either a race lost the claim or persistence is down — re-read for truth.
    const fresh = await getApprovalRequest(id);
    return NextResponse.json(
      { error: "Could not record decision", approval: fresh ? toView(fresh) : toView(auth.approval) },
      { status: 409 },
    );
  }

  if (decision === "declined") {
    return NextResponse.json({ approval: toView(claimed) });
  }

  // Approved → run the real side-effect now.
  const executor = getExecutor(claimed.action_type);
  if (!executor) {
    await markFailed(id, `No executor registered for "${claimed.action_type}".`);
    const fresh = await getApprovalRequest(id);
    return NextResponse.json({ approval: toView(fresh ?? claimed) });
  }

  const parsed = executor.schema.safeParse(claimed.payload);
  if (!parsed.success) {
    await markFailed(id, "Stored payload no longer matches the action schema.");
    const fresh = await getApprovalRequest(id);
    return NextResponse.json({ approval: toView(fresh ?? claimed) });
  }

  try {
    const result = await executor.execute(
      { workspaceId: claimed.workspace_id, userId: auth.userId, requestedBy: claimed.requested_by },
      parsed.data,
    );
    await markExecuted(id, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(id, message);
  }

  const fresh = await getApprovalRequest(id);
  return NextResponse.json({ approval: toView(fresh ?? claimed) });
}
