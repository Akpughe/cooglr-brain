"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/gateway";

export function useGateway() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentAssistantRef = useRef("");

  useEffect(() => {
    const es = new EventSource("/api/gateway");
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      setStreaming(false);
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);

        if (event.event === "agent") {
          const { stream, data } = event.payload || {};

          // Assistant text stream — data.text contains full text so far
          if (stream === "assistant" && data?.text) {
            currentAssistantRef.current = data.text as string;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: currentAssistantRef.current },
                ];
              }
              return [
                ...prev,
                { role: "assistant", content: currentAssistantRef.current },
              ];
            });
          }

          // Lifecycle events — end or error means the run is complete
          if (stream === "lifecycle" && (data?.phase === "end" || data?.phase === "error")) {
            if (data?.phase === "error" && data?.error) {
              // Show the error message to the user
              const errorMsg = data.error as string;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev;
                return [...prev, { role: "assistant", content: `Error: ${errorMsg}` }];
              });
            }
            setStreaming(false);
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
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to reach the server." },
      ]);
      setStreaming(false);
    }
  }, []);

  return { messages, sendMessage, streaming, connected };
}
