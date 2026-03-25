import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getGateway } from "@/lib/gateway/connection";

// GET — list tickets with optional status filter
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST — create a ticket and trigger AI triage
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description, type, priority, department, target_repo } = await request.json();

  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      title,
      description: description || "",
      type: type || "bug",
      priority: priority || "medium",
      department: department || null,
      target_repo: target_repo || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger AI triage in the background (don't await)
  triageTicket(ticket.id, title, description || "", type || "bug").catch((err) =>
    console.error("[triage] failed:", err)
  );

  return NextResponse.json(ticket);
}

// PATCH — update ticket status, assignee, etc.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Ticket ID required" }, { status: 400 });
  }

  const allowed = ["status", "priority", "assignee_id", "target_repo", "pr_url"];
  const filtered: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("tickets")
    .update(filtered)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// AI triage function — asks OpenClaw to analyze the ticket
async function triageTicket(ticketId: string, title: string, description: string, type: string) {
  const gateway = getGateway();

  if (!gateway.isConnected) {
    await gateway.connect();
  }

  const triagePrompt = `You are triaging a ticket for the engineering team. Analyze this ticket and provide a JSON response with your assessment.

Ticket Type: ${type}
Title: ${title}
Description: ${description}

Respond with ONLY a JSON object (no markdown, no code fences) containing:
{
  "summary": "Brief one-line summary of the issue",
  "likely_area": "frontend | backend | database | infrastructure | unknown",
  "suggested_repo": "the most likely repository or codebase area",
  "suggested_priority": "low | medium | high | critical",
  "root_cause_hypothesis": "what you think might be causing this",
  "suggested_next_steps": ["step 1", "step 2"]
}`;

  const sessionKey = `agent:main:triage-${ticketId}`;
  let fullResponse = "";

  // Single event handler for both streaming text and lifecycle end
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve();
    }, 30000);

    const unsubscribe = gateway.onSessionEvent(sessionKey, (event) => {
      const payload = event.payload as Record<string, unknown>;
      const data = payload.data as Record<string, unknown> | undefined;

      if (payload.stream === "assistant" && data?.text) {
        fullResponse = data.text as string;
      }

      if (payload.stream === "lifecycle" && data?.phase === "end") {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });

    // Send the message AFTER subscribing to avoid missing events
    gateway.sendRequest("chat.send", {
      sessionKey,
      message: triagePrompt,
      idempotencyKey: `triage-${ticketId}-${Date.now()}`,
    }).catch(() => {
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });

  // Parse and save triage result
  if (fullResponse) {
    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      const triage = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (triage) {
        const { createServiceClient } = await import("@/lib/supabase/server");
        const adminClient = await createServiceClient();

        await adminClient
          .from("tickets")
          .update({ ai_triage: triage })
          .eq("id", ticketId);

        await adminClient
          .from("ticket_comments")
          .insert({
            ticket_id: ticketId,
            content: `**AI Triage Analysis**\n\n**Area:** ${triage.likely_area}\n**Suggested Repo:** ${triage.suggested_repo}\n**Priority:** ${triage.suggested_priority}\n\n**Hypothesis:** ${triage.root_cause_hypothesis}\n\n**Next Steps:**\n${(triage.suggested_next_steps || []).map((s: string) => `- ${s}`).join("\n")}`,
            is_ai: true,
          });

        console.log(`[triage] ticket ${ticketId} triaged:`, triage.likely_area);
      }
    } catch (e) {
      console.error("[triage] failed to parse response:", e);
    }
  }
}
