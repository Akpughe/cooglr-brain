"use client";

import { useEffect, useState, useRef } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Group sessions by time
  const grouped = groupSessions(filteredSessions);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Chat session sidebar */}
      <div className={cn(
        "flex flex-col shrink-0 h-full border-r border-border bg-card transition-[width,opacity] duration-200 ease-out overflow-hidden",
        sidebarOpen ? "w-[260px]" : "w-0 border-r-0"
      )}>
        <div className="px-3 pt-3 pb-1 shrink-0">
          <button
            onClick={createSession}
            className="w-full flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground hover:border-primary/25 hover:bg-muted/40 transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>New chat</span>
          </button>
        </div>

        {sessions.length > 4 && (
          <div className="px-3 py-1.5 shrink-0">
            <div className="relative">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-2.5 text-[12px] rounded-md bg-muted/40 border-none focus:outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
          {filteredSessions.length === 0 && searchQuery && (
            <p className="text-[12px] text-muted-foreground/60 text-center py-8">No results</p>
          )}

          {grouped.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-px">
                {group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative flex items-center rounded-lg cursor-pointer transition-all duration-100",
                      activeSessionId === session.id
                        ? "bg-accent"
                        : "hover:bg-muted/40"
                    )}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    {editingId === session.id ? (
                      <input
                        ref={editRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => renameSession(session.id, editName)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameSession(session.id, editName);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full h-8 text-[12px] px-3 mx-1 my-0.5 rounded-md bg-background border border-primary/30 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center w-full px-2.5 py-2">
                        <p className={cn(
                          "text-[13px] truncate flex-1 leading-snug",
                          activeSessionId === session.id ? "font-medium text-foreground" : "text-muted-foreground"
                        )}>
                          {session.name}
                        </p>
                        <div className="flex items-center gap-px opacity-0 group-hover:opacity-100 transition-opacity duration-100 ml-1">
                          <button
                            className="p-1 rounded-md hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors"
                            onClick={(e) => { e.stopPropagation(); startEditing(session.id, session.name); }}
                            title="Rename"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                          </button>
                          {sessions.length > 1 && (
                            <button
                              className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors"
                              onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                              title="Delete"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
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
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <div className="h-[52px] border-b border-border flex items-center px-4 shrink-0 gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
            </svg>
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex-1 min-w-0">
            {activeSessionId && (
              <p className="text-[13px] font-medium text-foreground truncate">
                {sessions.find(s => s.id === activeSessionId)?.name || "Chat"}
              </p>
            )}
          </div>
        </div>

        {/* Chat content */}
        <div className="flex-1 min-h-0">
          {activeSessionId ? (
            <ChatPanel
              key={activeSessionId}
              sessionId={activeSessionId}
              onFirstMessage={(msg) => handleAutoName(activeSessionId, msg)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-[280px]">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">No chat selected</p>
                <p className="text-xs text-muted-foreground mt-1">Create a new chat to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function groupSessions(sessions: ChatSession[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 7 * 86400000;

  const groups: { label: string; sessions: ChatSession[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "This week", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  for (const s of sessions) {
    const t = new Date(s.updated_at).getTime();
    if (t >= todayStart) groups[0].sessions.push(s);
    else if (t >= yesterdayStart) groups[1].sessions.push(s);
    else if (t >= weekStart) groups[2].sessions.push(s);
    else groups[3].sessions.push(s);
  }

  return groups.filter((g) => g.sessions.length > 0);
}
