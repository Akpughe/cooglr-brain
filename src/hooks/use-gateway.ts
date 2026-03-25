"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/gateway";

export function useGateway() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentAssistantRef = useRef("");

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

  // SSE connection for real-time events
  useEffect(() => {
    const es = new EventSource("/api/gateway");
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      setStreaming(false);
      setThinking(false);
      setToolActivity(null);
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);

        if (event.event === "agent") {
          const { stream, data } = event.payload || {};

          // Lifecycle start — show thinking
          if (stream === "lifecycle" && data?.phase === "start") {
            setThinking(true);
            setToolActivity(null);
          }

          // Assistant text stream — shows response appearing word by word
          if (stream === "assistant" && data?.text) {
            setThinking(false);
            // Extract first sentence as activity hint if still early in response
            const text = data.text as string;
            if (text.length < 80 && !text.includes("\n")) {
              setToolActivity(text);
            } else {
              setToolActivity(null);
            }
            currentAssistantRef.current = data.text as string;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && !last.timestamp) {
                // Update the current streaming message (no timestamp = still streaming)
                return [
                  ...prev.slice(0, -1),
                  { role: "assistant" as const, content: currentAssistantRef.current },
                ];
              }
              return [
                ...prev,
                { role: "assistant" as const, content: currentAssistantRef.current },
              ];
            });
          }

          // Tool use events — show what the AI is doing
          if (stream === "tool-call" || stream === "tool_use") {
            const toolName = data?.name || data?.toolName || "working";
            setThinking(false);
            setToolActivity(formatToolName(toolName as string));
          }

          // Tool result — clear tool activity
          if (stream === "tool-result" || stream === "tool_result") {
            setToolActivity(null);
            setThinking(true); // Back to thinking after tool result
          }

          // Lifecycle end/error — run complete
          if (stream === "lifecycle" && (data?.phase === "end" || data?.phase === "error")) {
            if (data?.phase === "error" && data?.error) {
              const errorMsg = data.error as string;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.timestamp) return prev;
                return [...prev, { role: "assistant", content: `Error: ${errorMsg}` }];
              });
            }
            setStreaming(false);
            setThinking(false);
            setToolActivity(null);
            currentAssistantRef.current = "";
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      es.close();
    };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setThinking(true);
    currentAssistantRef.current = "";

    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.error}` },
        ]);
        setStreaming(false);
        setThinking(false);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to reach the server." },
      ]);
      setStreaming(false);
      setThinking(false);
    }
  }, []);

  return { messages, sendMessage, streaming, connected, thinking, toolActivity, historyLoaded };
}

function formatToolName(name: string): string {
  // Make tool names human-friendly
  const map: Record<string, string> = {
    "google-calendar-create": "Creating calendar event...",
    "google-calendar-list": "Checking calendar...",
    "gmail-send": "Sending email...",
    "gmail-read": "Reading emails...",
    "github-create-issue": "Creating GitHub issue...",
    "github-create-pr": "Creating pull request...",
    "web-search": "Searching the web...",
    "web-browse": "Browsing a page...",
    "bash": "Running a command...",
    "file-read": "Reading a file...",
    "file-write": "Writing a file...",
  };

  if (map[name]) return map[name];

  // Generic formatting: snake_case/kebab-case → sentence
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) + "...";
}
