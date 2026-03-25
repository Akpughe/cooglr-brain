"use client";

import { useEffect, useState, useRef } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Load sessions once on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    fetch("/api/chat/sessions")
      .then((r) => r.json())
      .then(async (data: ChatSession[]) => {
        if (data.length > 0) {
          setSessions(data);
          setActiveSessionId(data[0].id);
        } else {
          // Create first session
          const res = await fetch("/api/chat/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "New Chat" }),
          });
          if (res.ok) {
            const session = await res.json();
            setSessions([session]);
            setActiveSessionId(session.id);
          }
        }
        setLoading(false);
      });
  }, []);

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

  async function renameSession(id: string, name: string) {
    if (!name.trim()) return;
    await fetch("/api/chat/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: name.trim() }),
    });
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)));
    setEditingId(null);
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setEditName(currentName);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  // Called by ChatPanel after first AI response to auto-name the session
  function handleAutoName(sessionId: string, firstMessage: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.name !== "New Chat") return;

    // Use first 40 chars of the user's first message as the name
    const autoName = firstMessage.length > 40 ? firstMessage.substring(0, 40) + "..." : firstMessage;
    renameSession(sessionId, autoName);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session sidebar */}
      <div className="w-56 border-r bg-muted/20 flex flex-col shrink-0 h-full">
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
                "group flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-accent text-sm",
                activeSessionId === session.id && "bg-accent"
              )}
              onClick={() => setActiveSessionId(session.id)}
            >
              {editingId === session.id ? (
                <Input
                  ref={editRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => renameSession(session.id, editName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameSession(session.id, editName);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-6 text-xs px-1"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span
                    className="truncate flex-1"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditing(session.id, session.name);
                    }}
                  >
                    {session.name}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                    <button
                      className="text-muted-foreground hover:text-foreground text-[10px] px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(session.id, session.name);
                      }}
                      title="Rename"
                    >
                      &#9998;
                    </button>
                    {sessions.length > 1 && (
                      <button
                        className="text-muted-foreground hover:text-destructive text-xs px-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        title="Delete"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 min-w-0">
        {activeSessionId ? (
          <ChatPanel
            key={activeSessionId}
            sessionId={activeSessionId}
            onFirstMessage={(msg) => handleAutoName(activeSessionId, msg)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Create a new chat to get started.
          </div>
        )}
      </div>
    </div>
  );
}
