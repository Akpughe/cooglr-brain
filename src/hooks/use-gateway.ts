"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/gateway";

export function useGateway() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const currentTextRef = useRef("");
  const isStreamingRef = useRef(false);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/gateway/history")
      .then((r) => r.json())
      .then((history: ChatMessage[]) => {
        if (Array.isArray(history) && history.length > 0) {
          // Clean up history — strip <final> tags, filter tool noise
          const cleaned = history
            .map((m) => ({
              ...m,
              content: cleanContent(m.content),
            }))
            .filter((m) => m.content.trim().length > 0);
          setMessages(cleaned);
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource("/api/gateway");

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      setStreaming(false);
      setStatusText(null);
      isStreamingRef.current = false;
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.event !== "agent") return;

        const { stream, data } = event.payload || {};

        // Lifecycle start
        if (stream === "lifecycle" && data?.phase === "start") {
          setStatusText("Thinking...");
        }

        // Assistant text stream
        if (stream === "assistant") {
          const rawText = (data?.text || "") as string;
          const delta = (data?.delta || "") as string;

          // Skip tool output noise — these are internal
          if (isToolNoise(rawText)) {
            // Show a status hint about what's happening
            const hint = extractToolHint(rawText);
            if (hint) setStatusText(hint);
            return;
          }

          // Extract and clean the displayable text
          const displayText = cleanContent(rawText);

          if (displayText.trim()) {
            setStatusText(null);
            currentTextRef.current = displayText;

            setMessages((prev) => {
              if (isStreamingRef.current && prev.length > 0) {
                const last = prev[prev.length - 1];
                if (last.role === "assistant" && !last.timestamp) {
                  return [...prev.slice(0, -1), { role: "assistant" as const, content: displayText }];
                }
              }
              isStreamingRef.current = true;
              return [...prev, { role: "assistant" as const, content: displayText }];
            });
          } else if (delta.trim() && !isToolNoise(delta)) {
            // Delta without displayable full text yet — show as status
            const hint = extractToolHint(delta);
            if (hint) setStatusText(hint);
          }
        }

        // Tool events
        if (stream === "tool-call" || stream === "tool_use") {
          const toolName = (data?.name || data?.toolName || "processing") as string;
          setStatusText(formatToolName(toolName));
        }

        if (stream === "tool-result" || stream === "tool_result") {
          setStatusText("Processing results...");
        }

        // Lifecycle end/error
        if (stream === "lifecycle" && (data?.phase === "end" || data?.phase === "error")) {
          if (data?.phase === "error" && data?.error) {
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
          }
          setStreaming(false);
          setStatusText(null);
          currentTextRef.current = "";
          isStreamingRef.current = false;
        }
      } catch {
        // ignore
      }
    };

    return () => es.close();
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStatusText("Thinking...");
    currentTextRef.current = "";
    isStreamingRef.current = false;

    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.error}` }]);
        setStreaming(false);
        setStatusText(null);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to reach the server." }]);
      setStreaming(false);
      setStatusText(null);
    }
  }, []);

  return { messages, sendMessage, streaming, connected, statusText, historyLoaded };
}

/** Strip <final> tags and clean up display text */
function cleanContent(text: string): string {
  // Extract content from <final> tags if present
  const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/);
  if (finalMatch) return finalMatch[1].trim();

  // Strip any remaining XML-like tags
  return text.replace(/<\/?final>/g, "").trim();
}

/** Check if text is internal tool output noise */
function isToolNoise(text: string): boolean {
  const noise = [
    /^(message_id|thread_id|Command exited|unknown flag)/i,
    /^Usage:\s+gh\s/,
    /^Flags:/,
    /^\s*--\w+/,
    /^\s*-\w,\s+--/,
    /^\d+$/,  // bare numbers (exit codes)
    /^\(Command exited/,
  ];
  const lines = text.trim().split("\n");
  // If most lines match noise patterns, it's tool output
  const noiseLines = lines.filter((line) => noise.some((p) => p.test(line.trim())));
  return noiseLines.length > lines.length * 0.5 && lines.length > 1;
}

/** Extract a human-readable hint from tool output */
function extractToolHint(text: string): string | null {
  if (text.includes("message_id")) return "Sending email...";
  if (text.includes("gh api")) return "Checking GitHub...";
  if (text.includes("calendar")) return "Checking calendar...";
  if (text.includes("commit")) return "Checking commits...";
  return null;
}

function formatToolName(name: string): string {
  const map: Record<string, string> = {
    "google-calendar-create": "Creating calendar event...",
    "google-calendar-list": "Checking calendar...",
    "gmail-send": "Sending email...",
    "gmail-read": "Reading emails...",
    "github-create-issue": "Creating GitHub issue...",
    "github-create-pr": "Creating pull request...",
    "web-search": "Searching the web...",
    "bash": "Running a command...",
  };
  if (map[name]) return map[name];
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + "...";
}
