// Per-thread mutations for the agent shell.
//   DELETE  — archive (soft-delete) a thread
//   PATCH   — rename / pin a thread
//
// Security: like POST /api/agent, the authenticated user is derived from the
// session and membership is ALWAYS verified server-side with the SERVICE
// client against workspace_members — the thread's workspace_id is loaded from
// the DB (never trusted from the client).

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Authenticate, load the thread, and confirm the user is a member of its
// workspace. Returns either an error response or the thread's identity.
async function authorizeThread(
  id: string
): Promise<
  | { error: NextResponse }
  | { thread: { workspace_id: string; user_id: string } }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const svc = await createServiceClient();
  const { data: thread } = await svc
    .from("agent_threads")
    .select("workspace_id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!thread) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const { data: membership } = await svc
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", thread.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { thread: thread as { workspace_id: string; user_id: string } };
}

// DELETE /api/agent/threads/[id] — archive (soft-delete) the thread.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await authorizeThread(id);
  if ("error" in auth) return auth.error;

  const svc = await createServiceClient();
  const { error } = await svc
    .from("agent_threads")
    .update({ archived: true })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// PATCH /api/agent/threads/[id] — rename and/or pin the thread.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await authorizeThread(id);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { title?: string; pinned?: boolean };
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (trimmed) updates.title = trimmed;
  }
  if (typeof body.pinned === "boolean") {
    updates.pinned = body.pinned;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("agent_threads")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ thread: data });
}
