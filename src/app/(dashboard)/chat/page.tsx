"use client";

import { useEffect, useState, useCallback } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatSession {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/chat/sessions");
    if (res.ok) {
      const data = await res.json();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      } else if (data.length === 0) {
        const newRes = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Chat" }),
        });
        if (newRes.ok) {
          const session = await newRes.json();
          setSessions([session]);
          setActiveSessionId(session.id);
        }
      }
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function createSession() {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Chat" }),
    });
    if (res.ok) {
      const session = await res.json();
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    }
  }

  async function deleteSession(id: string) {
    await fetch("/api/chat/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0]?.id || null);
      }
      return remaining;
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-56 border-r bg-muted/20 flex flex-col">
        <div className="p-3 border-b">
          <Button onClick={createSession} className="w-full" size="sm">
            + New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent text-sm border-b border-transparent",
                activeSessionId === session.id && "bg-accent"
              )}
              onClick={() => setActiveSessionId(session.id)}
            >
              <span className="truncate flex-1">{session.name}</span>
              {sessions.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1">
        {activeSessionId ? (
          <ChatPanel key={activeSessionId} sessionId={activeSessionId} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Create a new chat to get started.
          </div>
        )}
      </div>
    </div>
  );
}
