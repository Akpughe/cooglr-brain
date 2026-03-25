import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGateway } from "@/lib/gateway/connection";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gateway = getGateway();

  if (!gateway.isConnected) {
    try {
      await gateway.connect();
    } catch {
      return NextResponse.json([]);
    }
  }

  try {
    const response = await gateway.getChatHistory(user.id);
    if (!response.ok || !response.payload) return NextResponse.json([]);

    const payload = response.payload as { messages?: Array<{
      role: string;
      content: Array<{ type: string; text?: string; thinking?: string }>;
      timestamp: number;
    }> };

    // Convert OpenClaw history format to our ChatMessage format
    const messages = (payload.messages || []).map((msg) => {
      const textParts = (msg.content || [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n");

      return {
        role: msg.role as "user" | "assistant",
        content: textParts || "(no content)",
        timestamp: new Date(msg.timestamp).toISOString(),
      };
    }).filter((m) => m.content && m.content !== "(no content)");

    return NextResponse.json(messages);
  } catch {
    return NextResponse.json([]);
  }
}
