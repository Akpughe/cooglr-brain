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
  const [searchQuery, setSearchQuery] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

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
      if (activeSessionId === id) setActiveSessionId(remaining[0]?.id || null);
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

  function handleAutoName(sessionId: string, firstMessage: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.name !== "New Chat") return;
    const autoName = firstMessage.length > 40 ? firstMessage.substring(0, 40) + "..." : firstMessage;
    renameSession(sessionId, autoName);
  }

  const filteredSessions = searchQuery
    ? sessions.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session sidebar */}
      <div className="w-[260px] border-r border-border bg-muted/20 flex flex-col shrink-0 h-full">
        {/* Header */}
        <div className="p-3 space-y-2 shrink-0">
          <Button onClick={createSession} className="w-full rounded-xl h-9 text-xs font-medium" size="sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Chat
          </Button>
          {sessions.length > 3 && (
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg bg-background/50"
            />
          )}
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredSessions.length === 0 && searchQuery && (
            <p className="text-xs text-muted-foreground text-center py-4">No chats found</p>
          )}
          <div className="space-y-0.5">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative flex items-center rounded-lg cursor-pointer transition-all",
                  activeSessionId === session.id
                    ? "bg-card shadow-warm"
                    : "hover:bg-muted/50"
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
                    className="h-8 text-xs px-2 mx-1 my-1 rounded-md"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex items-center w-full px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-[13px] truncate",
                        activeSessionId === session.id ? "font-medium text-foreground" : "text-muted-foreground"
                      )}>
                        {session.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {formatSessionDate(session.updated_at)}
                      </p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity">
                      <button
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => { e.stopPropagation(); startEditing(session.id, session.name); }}
                        title="Rename"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {sessions.length > 1 && (
                        <button
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                          title="Delete"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
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
            <div className="text-center">
              <p className="text-lg font-medium mb-1">No chat selected</p>
              <p className="text-sm">Create a new chat to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
