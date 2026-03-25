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
    // Only show user messages and the final assistant text (strip tool noise)
    const messages = (payload.messages || []).map((msg) => {
      const textParts = (msg.content || [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => {
          let text = c.text || "";
          // Extract <final> content if present
          const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/);
          if (finalMatch) return finalMatch[1].trim();
          return text.replace(/<\/?final>/g, "").trim();
        })
        .filter((t) => {
          // Filter out tool noise
          if (!t) return false;
          if (t.startsWith("message_id") || t.startsWith("thread_id")) return false;
          if (t.startsWith("Usage:  gh")) return false;
          if (t.startsWith("unknown flag")) return false;
          if (t.match(/^\(Command exited/)) return false;
          if (t.match(/^Flags:\n/)) return false;
          if (t.match(/^\d+$/) && t.length < 5) return false;
          return true;
        })
        .join("\n");

      return {
        role: msg.role as "user" | "assistant",
        content: textParts,
        timestamp: new Date(msg.timestamp).toISOString(),
      };
    }).filter((m) => m.content.trim().length > 0);

    return NextResponse.json(messages);
  } catch {
    return NextResponse.json([]);
  }
}
