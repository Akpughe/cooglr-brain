"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/gateway";

export function useGateway() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const currentAssistantRef = useRef("");
  const isStreamingRef = useRef(false);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/gateway/history")
      .then((r) => r.json())
      .then((history: ChatMessage[]) => {
        if (Array.isArray(history) && history.length > 0) {
          setMessages(history);
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

        // Assistant text — stream it into the chat
        if (stream === "assistant" && data?.text) {
          const text = data.text as string;
          currentAssistantRef.current = text;
          setStatusText(null);

          setMessages((prev) => {
            // Find if we're already streaming (last message is our streaming bubble)
            if (isStreamingRef.current && prev.length > 0) {
              const last = prev[prev.length - 1];
              if (last.role === "assistant" && !last.timestamp) {
                return [...prev.slice(0, -1), { role: "assistant" as const, content: text }];
              }
            }
            isStreamingRef.current = true;
            return [...prev, { role: "assistant" as const, content: text }];
          });
        }

        // Tool call events
        if (stream === "tool-call" || stream === "tool_use") {
          const toolName = (data?.name || data?.toolName || "processing") as string;
          setStatusText(formatToolName(toolName));
        }

        // Tool result — back to thinking
        if (stream === "tool-result" || stream === "tool_result") {
          setStatusText("Processing...");
        }

        // Lifecycle end or error
        if (stream === "lifecycle" && (data?.phase === "end" || data?.phase === "error")) {
          if (data?.phase === "error" && data?.error) {
            const errorMsg = data.error as string;
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errorMsg}` }]);
          }
          setStreaming(false);
          setStatusText(null);
          currentAssistantRef.current = "";
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
    currentAssistantRef.current = "";
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
