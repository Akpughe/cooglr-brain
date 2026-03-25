import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGateway } from "@/lib/gateway/connection";

// POST /api/gateway — send a chat message, save to Supabase, forward to OpenClaw
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

    if (sessionId) {
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        user_id: user.id,
        role: "user",
        content: message,
      });
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

// GET /api/gateway — single persistent SSE stream for ALL user sessions
// Events include sessionKey so the client can filter by active session
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gateway = getGateway();

  if (!gateway.isConnected) {
    try {
      await gateway.connect();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Gateway connection failed";
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }
  }

  const userPrefix = `agent:main:user-${user.id}`;
  const encoder = new TextEncoder();

  // Track assistant text per session key for saving
  const sessionTexts = new Map<string, string>();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      // Subscribe to ALL gateway events and filter by user prefix
      const unsubscribe = gateway.onEvent((event) => {
        if (closed) return;

        const payload = event.payload as Record<string, unknown>;
        const sessionKey = payload.sessionKey as string | undefined;

        // Only forward events for this user's sessions
        if (!sessionKey || !sessionKey.startsWith(userPrefix)) return;

        const data = payload.data as Record<string, unknown> | undefined;

        // Track assistant text per session
        if (payload.stream === "assistant" && data?.text) {
          sessionTexts.set(sessionKey, data.text as string);
        }

        // On lifecycle end, save assistant response to Supabase
        if (payload.stream === "lifecycle" && data?.phase === "end") {
          const text = sessionTexts.get(sessionKey);
          if (text) {
            // Extract chat session ID from the key: agent:main:user-<userId>-<sessionId>
            const parts = sessionKey.replace(userPrefix + "-", "");
            const chatSessionId = parts !== sessionKey ? parts : null;

            if (chatSessionId) {
              let cleanText = text;
              const finalMatch = cleanText.match(/<final>([\s\S]*?)<\/final>/);
              if (finalMatch) cleanText = finalMatch[1].trim();
              else cleanText = cleanText.replace(/<\/?final>/g, "").trim();

              if (cleanText) {
                supabase.from("chat_messages").insert({
                  session_id: chatSessionId,
                  user_id: user.id,
                  role: "assistant",
                  content: cleanText,
                }).then(() => {});
              }
            }
            sessionTexts.delete(sessionKey);
          }
        }

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
