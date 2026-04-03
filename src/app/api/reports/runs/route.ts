import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — list runs for a report session
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!sessionId) return NextResponse.json([]);

  const query = supabase
    .from("report_runs")
    .select("*")
    .eq("report_session_id", sessionId)
    .order("created_at", { ascending: true });

  if (workspaceId) {
    query.eq("workspace_id", workspaceId);
  } else {
    query.eq("user_id", user.id);
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}

// POST — save a run result
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, prompt, generatedSql, resultColumns, resultRowCount, error: runError, workspaceId } = await request.json();

  const { data, error } = await supabase
    .from("report_runs")
    .insert({
      report_session_id: sessionId,
      user_id: user.id,
      workspace_id: workspaceId || null,
      prompt,
      generated_sql: generatedSql,
      result_columns: resultColumns || [],
      result_row_count: resultRowCount || 0,
      error: runError || null,
    })
    .select()
    .single();

  // Update session name from first prompt and updated_at
  const sessionQuery = supabase
    .from("report_sessions")
    .update({
      name: prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (workspaceId) {
    sessionQuery.eq("workspace_id", workspaceId);
  } else {
    sessionQuery.eq("user_id", user.id);
  }

  await sessionQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — save generated report to a run
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId, generatedReport, workspaceId } = await request.json();
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  const query = supabase
    .from("report_runs")
    .update({ generated_report: generatedReport })
    .eq("id", runId);

  if (workspaceId) {
    query.eq("workspace_id", workspaceId);
  } else {
    query.eq("user_id", user.id);
  }

  await query;
  return NextResponse.json({ ok: true });
}
