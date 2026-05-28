import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startGmailConnection } from "@/lib/composio/gmail-ingest";

// POST /api/composio/connect — start an OAuth connection for a toolkit.
// Returns { redirectUrl } to send the user to Composio's hosted consent screen.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toolkit } = await request.json();
  if (toolkit !== "gmail") {
    return NextResponse.json({ error: "Only 'gmail' is supported for now" }, { status: 400 });
  }

  try {
    const { redirectUrl, connectionId } = await startGmailConnection(user.id);
    return NextResponse.json({ redirectUrl, connectionId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Connect failed" }, { status: 500 });
  }
}
