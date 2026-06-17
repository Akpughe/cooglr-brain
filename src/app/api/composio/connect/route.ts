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
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Cached resolver (60s) — the agent run and the client UI share one source of
  // truth and avoid hammering Composio on every mention-menu open / page mount.
  // `?fresh=1` bypasses the cache (used by the Connectors view after a connect).
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const { configuredToolkits } = await import("@/lib/composio/connect");
  const { resolveConnectedToolkits } = await import("@/lib/composio/actions");
  const [configured, connected] = await Promise.all([
    Promise.resolve(configuredToolkits()),
    resolveConnectedToolkits(user.id, { fresh }),
  ]);
  return NextResponse.json({ configured, connected });
}
