import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — list runs for a report session
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json([]);

  const { data } = await supabase
    .from("report_runs")
    .select("*")
    .eq("report_session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json(data || []);
}

// POST — save a run result
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, prompt, generatedSql, resultColumns, resultRowCount, error: runError } = await request.json();

  const { data, error } = await supabase
    .from("report_runs")
    .insert({
      report_session_id: sessionId,
      user_id: user.id,
      prompt,
      generated_sql: generatedSql,
      result_columns: resultColumns || [],
      result_row_count: resultRowCount || 0,
      error: runError || null,
    })
    .select()
    .single();

  // Update session name from first prompt and updated_at
  await supabase
    .from("report_sessions")
    .update({
      name: prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
