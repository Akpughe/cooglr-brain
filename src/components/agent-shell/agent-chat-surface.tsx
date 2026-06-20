"use client";

import { useEffect, useRef, useState } from "react";
import { PanelRight, Globe, BarChart3, ArrowRight, MoreHorizontal } from "lucide-react";
import { AgentComposer } from "./agent-composer";
import { AgentMessage, type SourceRef } from "./agent-message";
import { AgentDocumentViewer, type OpenDocument } from "./agent-document-viewer";
import { GoogleMeetLogo, NotionLogo, TeamsLogo } from "./agent-brand-icons";
import type { AgentArtifact, ModelProfile } from "./types";

interface UIMessageLike {
  id: string;
  role: string;
  parts?: Record<string, unknown>[];
}

interface Props {
  isEmpty: boolean;
  messages: UIMessageLike[];
  status: "ready" | "submitted" | "streaming" | "error";
  modelProfile: ModelProfile;
  onModelProfileChange: (p: ModelProfile) => void;
  onSend: (text: string, focusFileIds?: string[]) => void;
  onStop: () => void;
  outputsOpen: boolean;
  onToggleOutputs: () => void;
  artifact: AgentArtifact | null;
  openDoc?: OpenDocument | null;
  onToggleDoc?: () => void;
  onOpenSource?: (ref: SourceRef) => void;
  onConnectApps?: () => void;
}

function deriveTitle(messages: UIMessageLike[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.parts
    ?.filter((p) => p.type === "text")
    .map((p) => String((p as { text?: string }).text ?? ""))
    .join("");
  if (!text) return "New chat";
  return text.length > 56 ? text.slice(0, 56) + "…" : text;
}

function fmtDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

type Suggestion = {
  icon: React.ReactNode;
  before: string;
  keyword: string;
  after: string;
  prompt: string;
};

const SUGGESTIONS: Suggestion[] = [
  { icon: <GoogleMeetLogo size={18} />, before: "List my action points from my ", keyword: "Google Meet", after: "", prompt: "List my action points from my Google Meet" },
  { icon: <Globe style={{ width: 18, height: 18, color: "var(--ink-2)" }} />, before: "Browse the ", keyword: "web", after: " and write a newsletter", prompt: "Browse the web and write a newsletter" },
  { icon: <BarChart3 style={{ width: 18, height: 18, color: "var(--ink-2)" }} />, before: "Create a financial analysis and plot data in ", keyword: "graphs", after: "", prompt: "Create a financial analysis and plot data in graphs" },
  { icon: <NotionLogo size={18} />, before: "Analyze our ", keyword: "Notion", after: " documentation", prompt: "Analyze our Notion documentation" },
  { icon: <TeamsLogo size={18} />, before: "Summarize my ", keyword: "Teams", after: " meetings from yesterday", prompt: "Summarize my Teams meetings from yesterday" },
];

export function AgentChatSurface({
  isEmpty,
  messages,
  status,
  modelProfile,
  onModelProfileChange,
  onSend,
  onStop,
  outputsOpen,
  onToggleOutputs,
  openDoc,
  onToggleDoc,
  onOpenSource,
  onConnectApps,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "streaming" || status === "submitted";

  // Document side panel: opens 50/50, then drag-resizable + full-page toggle.
  // null width = equal split with the chat.
  const [docWidth, setDocWidth] = useState<number | null>(null);
  const [docFull, setDocFull] = useState(false);
  const resizingRef = useRef(false);
  const [resizing, setResizing] = useState(false);

  // Mobile: open documents as a full-screen overlay instead of a 50/50 split.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Keep the panel mounted through its close transition; animate width + opacity.
  const [mountedDoc, setMountedDoc] = useState<OpenDocument | null>(openDoc ?? null);
  const [panelOpen, setPanelOpen] = useState<boolean>(!!openDoc);
  useEffect(() => {
    if (openDoc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the mounted doc + animate open
      setMountedDoc(openDoc);
      const r = requestAnimationFrame(() => setPanelOpen(true));
      return () => cancelAnimationFrame(r);
    }
    setPanelOpen(false);
    const t = setTimeout(() => setMountedDoc(null), 280);
    return () => clearTimeout(t);
  }, [openDoc]);
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const w = window.innerWidth - e.clientX - 8;
      setDocWidth(Math.max(400, Math.min(window.innerWidth - 360, w)));
    }
    function onUp() {
      if (resizingRef.current) setResizing(false);
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);
  // Reset to an equal 50/50 split when a fresh doc opens.
  useEffect(() => {
    if (openDoc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset split geometry for a freshly opened doc
      setDocFull(false);
      setDocWidth(null);
    }
  }, [openDoc]);

  // Track per-run elapsed → duration label on the latest answer.
  const startedAtRef = useRef<number | null>(null);
  const [durationLabel, setDurationLabel] = useState<string | undefined>(undefined);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy && !wasBusy.current) startedAtRef.current = Date.now();
    if (!busy && wasBusy.current && startedAtRef.current) {
      setDurationLabel(fmtDuration(Date.now() - startedAtRef.current));
    }
    wasBusy.current = busy;
  }, [busy]);

  // Follow the stream, but don't fight the user: only auto-scroll when they're
  // already near the bottom, and jump instantly while tokens are streaming
  // (repeated "smooth" scrolls interrupt each other and look janky).
  const atBottomRef = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: busy ? "auto" : "smooth" });
    }
  }, [messages, busy]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i;
    return -1;
  })();

  return (
    <>
      <main
        className="canvas-panel"
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", margin: docFull && panelOpen ? "8px 0 8px 0" : "8px 8px 8px 0" }}
      >
        {/* header */}
        <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 18px", flexShrink: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isEmpty ? "New chat" : deriveTitle(messages)}
          </span>
          {!isEmpty && !openDoc && (
            <button
              className="iconbtn tip"
              type="button"
              aria-label="Open panel"
              data-tip="Open panel"
              onClick={onToggleDoc}
            >
              <PanelRight style={{ width: 17, height: 17 }} />
            </button>
          )}
        </div>

        {isEmpty ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 44px 70px",
            }}
          >
            <h1 className="rise" style={{ fontSize: 28, letterSpacing: "-0.022em" }}>
              What should we work on?
            </h1>
            <div className="rise" style={{ width: "min(660px,100%)", marginTop: 28, animationDelay: "0.05s" }}>
              <AgentComposer
                onSend={onSend}
                onStop={onStop}
                status={status}
                modelProfile={modelProfile}
                onModelProfileChange={onModelProfileChange}
                autoFocus
              />
            </div>
            <div
              className="rise"
              style={{ width: "min(660px,100%)", marginTop: 26, animationDelay: "0.1s" }}
            >
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s.prompt}
                  className="suggest-row"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}
                  onClick={() => onSend(s.prompt)}
                >
                  <span className="suggest-icon">{s.icon}</span>
                  <span className="suggest-text">
                    {s.before}
                    <strong>{s.keyword}</strong>
                    {s.after}
                  </span>
                </button>
              ))}
              <button
                className="suggest-row"
                style={{ borderTop: "1px solid var(--line-soft)" }}
                onClick={() => onConnectApps?.()}
              >
                <span className="suggest-icon">
                  <MoreHorizontal style={{ width: 18, height: 18, color: "var(--ink-3)" }} />
                </span>
                <span className="suggest-text" style={{ color: "var(--ink-2)" }}>
                  Connect your apps for better answers
                </span>
                <ArrowRight style={{ width: 15, height: 15, color: "var(--ink-3)", flexShrink: 0 }} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <div style={{ maxWidth: 740, margin: "0 auto", padding: "4px 40px 30px" }}>
                {messages.map((m, i) => (
                  <AgentMessage
                    key={m.id}
                    message={m}
                    busy={busy && i === messages.length - 1}
                    onOpenSource={onOpenSource}
                  />
                ))}
              </div>
            </div>
            <div style={{ flexShrink: 0, padding: "0 40px 22px", maxWidth: 740, margin: "0 auto", width: "100%", position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: -44,
                  height: 44,
                  background: "linear-gradient(transparent, var(--bg))",
                  pointerEvents: "none",
                }}
              />
              <AgentComposer
                onSend={onSend}
                onStop={onStop}
                status={status}
                modelProfile={modelProfile}
                onModelProfileChange={onModelProfileChange}
                placeholder="Ask a follow-up…"
              />
            </div>
          </div>
        )}
      </main>

      {mountedDoc && (
        <>
          {!docFull && panelOpen && !isMobile && (
            <div
              onMouseDown={() => {
                resizingRef.current = true;
                setResizing(true);
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
              style={{ width: 6, flexShrink: 0, cursor: "col-resize", alignSelf: "stretch" }}
              title="Drag to resize"
            />
          )}
          <div
            style={
              isMobile
                ? {
                    position: "fixed",
                    inset: 0,
                    zIndex: 95,
                    display: panelOpen ? "flex" : "none",
                    background: "var(--bg)",
                    opacity: panelOpen ? 1 : 0,
                    transition: "opacity 0.2s ease",
                  }
                : {
                    width: !panelOpen ? 0 : docFull ? "100%" : docWidth == null ? "50%" : `${docWidth}px`,
                    flexShrink: 0,
                    minWidth: 0,
                    display: "flex",
                    overflow: "hidden",
                    opacity: panelOpen ? 1 : 0,
                    transition: resizing ? "none" : "width 0.26s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
                  }
            }
          >
            <AgentDocumentViewer
              doc={mountedDoc}
              onClose={onToggleDoc}
              isFull={docFull}
              onToggleFull={() => setDocFull((f) => !f)}
            />
          </div>
        </>
      )}
    </>
  );
}
