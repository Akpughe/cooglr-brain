import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGateway } from "@/lib/gateway/connection";

// POST /api/gateway — send a chat message (scoped to user + chat session)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, sessionId } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const gateway = getGateway();

  try {
    if (!gateway.isConnected) await gateway.connect();

    // Update session's updated_at timestamp
    if (sessionId) {
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("user_id", user.id);
    }

    const response = await gateway.sendChat(message, user.id, sessionId);
    return NextResponse.json(response);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Gateway error";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}

// GET /api/gateway — SSE stream filtered to the user's session
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("sessionId") || undefined;
  const gateway = getGateway();

  if (!gateway.isConnected) {
    try {
      await gateway.connect();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Gateway connection failed";
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }
  }

  const sessionKey = gateway.userSessionKey(user.id, sessionId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const unsubscribe = gateway.onSessionEvent(sessionKey, (event) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });

      const keepalive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        unsubscribe();
        clearInterval(keepalive);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
