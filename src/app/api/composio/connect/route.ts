import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startConnection, SUPPORTED_TOOLKITS } from "@/lib/composio/connect";

// POST /api/composio/connect { toolkit } — start an OAuth connection for any
// supported toolkit (gmail | github | slack | google-drive). Returns the
// hosted consent redirectUrl.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toolkit } = await request.json();
  if (!SUPPORTED_TOOLKITS.includes(toolkit)) {
    return NextResponse.json({ error: `Unsupported toolkit. Supported: ${SUPPORTED_TOOLKITS.join(", ")}` }, { status: 400 });
  }

  try {
    const { redirectUrl, connectionId } = await startConnection(user.id, toolkit);
    return NextResponse.json({ redirectUrl, connectionId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Connect failed" }, { status: 500 });
  }
}

// GET /api/composio/connect — which toolkits are configured + which this user
// has connected.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { configuredToolkits, listConnectedToolkits } = await import("@/lib/composio/connect");
  const [configured, connected] = await Promise.all([
    Promise.resolve(configuredToolkits()),
    listConnectedToolkits(user.id),
  ]);
  return NextResponse.json({ configured, connected });
}
