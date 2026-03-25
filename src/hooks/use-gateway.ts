"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/gateway";

export interface ProcessStep {
  label: string;
  status: "running" | "done";
  timestamp: number;
}

export function useGateway() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const currentTextRef = useRef("");
  const isStreamingRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/gateway/history")
      .then((r) => r.json())
      .then((history: ChatMessage[]) => {
        if (Array.isArray(history) && history.length > 0) {
          const cleaned = history
            .map((m) => ({ ...m, content: cleanContent(m.content) }))
            .filter((m) => m.content.trim().length > 0);
          setMessages(cleaned);
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, []);

  // Elapsed time ticker
  function startTimer() {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 100);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startTimeRef.current = null;
    setElapsedMs(0);
  }

  // SSE connection
  useEffect(() => {
    const es = new EventSource("/api/gateway");

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      setStreaming(false);
      setStatusText(null);
      setProcessSteps([]);
      isStreamingRef.current = false;
      stopTimer();
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.event !== "agent") return;

        const { stream, data } = event.payload || {};

        // Lifecycle start — begin thinking
        if (stream === "lifecycle" && data?.phase === "start") {
          setStatusText("Thinking...");
          setProcessSteps([{ label: "Processing your request", status: "running", timestamp: Date.now() }]);
          startTimer();
        }

        // Assistant text stream
        if (stream === "assistant" && data?.text) {
          const rawText = data.text as string;

          if (isToolNoise(rawText)) {
            // Tool output — add as a process step
            const hint = extractToolHint(rawText);
            if (hint) {
              setStatusText(hint);
              setProcessSteps((prev) => {
                const updated = prev.map((s) =>
                  s.status === "running" ? { ...s, status: "done" as const } : s
                );
                return [...updated, { label: hint, status: "running" as const, timestamp: Date.now() }];
              });
            }
            return;
          }

          const displayText = cleanContent(rawText);

          if (displayText.trim()) {
            // Mark all steps as done, add "Composing response"
            setProcessSteps((prev) =>
              prev.map((s) => (s.status === "running" ? { ...s, status: "done" as const } : s))
            );
            setStatusText(null);
            stopTimer();
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
          }
        }

        // Lifecycle end/error
        if (stream === "lifecycle" && (data?.phase === "end" || data?.phase === "error")) {
          if (data?.phase === "error" && data?.error) {
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
          }
          setStreaming(false);
          setStatusText(null);
          setProcessSteps((prev) =>
            prev.map((s) => (s.status === "running" ? { ...s, status: "done" as const } : s))
          );
          stopTimer();
          currentTextRef.current = "";
          isStreamingRef.current = false;
        }
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
      stopTimer();
    };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStatusText("Thinking...");
    setProcessSteps([]);
    currentTextRef.current = "";
    isStreamingRef.current = false;

    const safetyTimeout = setTimeout(() => {
      setStreaming(false);
      setStatusText(null);
      setProcessSteps([]);
      isStreamingRef.current = false;
      stopTimer();
    }, 60000);

    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        clearTimeout(safetyTimeout);
        const err = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.error}` }]);
        setStreaming(false);
        setStatusText(null);
        setProcessSteps([]);
        isStreamingRef.current = false;
        stopTimer();
      }
    } catch {
      clearTimeout(safetyTimeout);
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to reach the server." }]);
      setStreaming(false);
      setStatusText(null);
      setProcessSteps([]);
      isStreamingRef.current = false;
      stopTimer();
    }
  }, []);

  return { messages, sendMessage, streaming, connected, statusText, processSteps, historyLoaded, elapsedMs };
}

function cleanContent(text: string): string {
  const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/);
  if (finalMatch) return finalMatch[1].trim();
  return text.replace(/<\/?final>/g, "").trim();
}

function isToolNoise(text: string): boolean {
  const noise = [
    /^(message_id|thread_id|Command exited|unknown flag)/i,
    /^Usage:\s+gh\s/,
    /^Flags:/,
    /^\s*--\w+/,
    /^\s*-\w,\s+--/,
    /^\d+$/,
    /^\(Command exited/,
  ];
  const lines = text.trim().split("\n");
  const noiseLines = lines.filter((line) => noise.some((p) => p.test(line.trim())));
  return noiseLines.length > lines.length * 0.5 && lines.length > 1;
}

function extractToolHint(text: string): string | null {
  if (text.includes("message_id")) return "Email sent successfully";
  if (text.includes("gh api") || text.includes("github.com")) return "Querying GitHub...";
  if (text.includes("calendar")) return "Checking calendar...";
  if (text.includes("commit")) return "Checking commits...";
  if (text.includes("Command exited with code 0")) return "Command completed";
  if (text.includes("Command exited with code")) return "Command finished with error";
  return null;
}
