import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { createSheet } from "@/lib/google";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, columns, rows } = await request.json();
  if (!title || !columns || !rows) return NextResponse.json({ error: "title, columns, rows required" }, { status: 400 });

  const token = await getUserToken(supabase, user.id, "google");
  if (!token) return NextResponse.json({ error: "Google not connected. Go to Settings to connect." }, { status: 400 });

  try {
    const sheet = await createSheet(token, title, columns, rows.map((r: Record<string, unknown>) => columns.map((c: string) => r[c])));
    return NextResponse.json({ url: sheet.spreadsheetUrl, id: sheet.spreadsheetId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed" }, { status: 500 });
  }
}
