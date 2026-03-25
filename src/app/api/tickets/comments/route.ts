import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — list comments for a ticket
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticketId = request.nextUrl.searchParams.get("ticketId");
  if (!ticketId) {
    return NextResponse.json({ error: "Ticket ID required" }, { status: 400 });
  }

  const { data } = await supabase
    .from("ticket_comments")
    .select("*, user:profiles!ticket_comments_user_id_fkey(email, full_name)")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return NextResponse.json(data || []);
}

// POST — add a comment
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId, content } = await request.json();

  if (!ticketId || !content) {
    return NextResponse.json({ error: "Ticket ID and content required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ticket_comments")
    .insert({ ticket_id: ticketId, user_id: user.id, content })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
