"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Menu, SquarePen } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useThreads, qk, invalidateThreads } from "@/lib/queries";
import { AgentThreadRail, type RailView } from "./agent-thread-rail";
import { AgentChatSurface } from "./agent-chat-surface";
import { AgentPluginsView } from "./agent-plugins-view";
import { AgentFoldersView } from "./agent-folders-view";
import { AgentFolderDetailView } from "./agent-folder-detail-view";
import { AgentSettingsView } from "./agent-settings-view";
import { AgentProfileView } from "./agent-profile-view";
import { AgentSearchPalette } from "./agent-search-palette";
import { AgentDocumentViewer, type OpenDocument } from "./agent-document-viewer";
import { buildFilePreview, loadingDocFor } from "@/lib/files/open-file";
import type { SourceRef } from "./agent-message";
import type { AgentArtifact, ModelProfile, ThreadSummary } from "./types";

type View = "chat" | "plugins" | "folders" | "folder-detail" | "settings" | "profile";
type OpenFolder = { id: string; name: string; owner?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  currentUserId: string;
  initialThreads: ThreadSummary[];
}

// Pull the latest source-grounded artifact out of the streamed tool results.
function deriveLatestArtifact(messages: ReturnType<typeof useChat>["messages"]): AgentArtifact | null {
  let latest: AgentArtifact | null = null;
  for (const m of messages) {
    for (const part of (m.parts ?? []) as Array<Record<string, unknown>>) {
      const type = String(part.type ?? "");
      const isTool = type.startsWith("tool-") || type === "dynamic-tool";
      if (!isTool) continue;
      const output = part.output as
        | {
            source?: "database" | "content";
            sql?: string | null;
            citations?: { fileId: string; score: number }[];
            origins?: string[];
            hasChart?: boolean;
            chart?: unknown;
          }
        | undefined;
      if (!output) continue;
      const hasContent =
        Boolean(output.chart) ||
        Boolean(output.sql) ||
        (output.citations?.length ?? 0) > 0 ||
        (output.origins?.length ?? 0) > 0;
      if (!hasContent) continue;
      latest = {
        id: String(part.toolCallId ?? m.id),
        kind: output.chart ? "chart" : "source_trace",
        title: output.chart ? "Chart" : "Sources",
        source: output.source,
        sql: output.sql ?? null,
        citations: output.citations ?? [],
        origins: output.origins ?? [],
        chart: output.chart,
      };
    }
  }
  return latest;
}

export function AgentWorkspaceShell({
  workspaceId,
  workspaceSlug,
  workspaceName,
  currentUserId,
  initialThreads,
}: Props) {
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [modelProfile, setModelProfile] = useState<ModelProfile>("auto");
  const [outputsOpen, setOutputsOpen] = useState(true);
  const [openDoc, setOpenDoc] = useState<OpenDocument | null>(null);
  const [lastDoc, setLastDoc] = useState<OpenDocument | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFolder, setOpenFolder] = useState<OpenFolder | null>(null);
  // Right-side file preview shown alongside the Folders/panel surfaces.
  const [panelDoc, setPanelDoc] = useState<OpenDocument | null>(null);
  const panelDocReqRef = useRef<string | null>(null);
  const qc = useQueryClient();
  const { data: threads = initialThreads } = useThreads(workspaceId, initialThreads);
  const setThreadsCache = useCallback(
    (updater: (prev: ThreadSummary[]) => ThreadSummary[]) =>
      qc.setQueryData<ThreadSummary[]>(qk.threads(workspaceId), (prev) => updater(prev ?? [])),
    [qc, workspaceId],
  );

  const openDocument = useCallback((d: OpenDocument) => { setOpenDoc(d); setLastDoc(d); }, []);
  const toggleDoc = useCallback(() => setOpenDoc((d) => (d ? null : lastDoc)), [lastDoc]);

  // Open a workspace file in the right-side viewer next to the Folders panel.
  // Guards against a slow fetch landing after the user clicked a different file.
  const openFileInPanel = useCallback(async (fileId: string, title: string) => {
    panelDocReqRef.current = fileId;
    setPanelDoc(loadingDocFor(title));
    const doc = await buildFilePreview(fileId, title);
    if (panelDocReqRef.current === fileId) setPanelDoc(doc);
  }, []);
  const closePanelDoc = useCallback(() => { panelDocReqRef.current = null; setPanelDoc(null); }, []);

  // Open a citation/source from a chat answer in the chat-side viewer. Charts
  // render inline; real files are fetched and previewed; memory/external refs
  // (no previewable file) get a clear message instead of a stuck spinner.
  const openSourceReqRef = useRef<string | null>(null);
  const openSource = useCallback(async (ref: SourceRef) => {
    if (ref.kind === "chart" && ref.chart) {
      openDocument({ title: ref.title, breadcrumb: ["Outputs", ref.title], kind: "chart", chart: ref.chart, table: ref.table });
      return;
    }
    const previewable = UUID_RE.test(ref.fileId) && ref.source !== "memory";
    if (!previewable) {
      const name = ref.title || ref.fileId;
      const from = ref.source && ref.source !== "file" ? ` (from ${ref.source})` : "";
      openDocument({
        title: name,
        breadcrumb: ["Sources", name],
        kind: "report",
        contentMd: `# ${name}\n\nThis source isn't a previewable file${from}. It was used as context for the answer.`,
      });
      return;
    }
    openSourceReqRef.current = ref.fileId;
    openDocument(loadingDocFor(ref.title || ref.fileId));
    const doc = await buildFilePreview(ref.fileId, ref.title || ref.fileId);
    if (openSourceReqRef.current === ref.fileId) openDocument(doc);
  }, [openDocument]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/agent" }),
    [],
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport,
    // Capture the (possibly new) thread id the server emits so the sidebar can
    // refresh without a reload, and subsequent messages stay on the same thread.
    onData: (part: { type: string; data?: unknown }) => {
      if (part.type === "data-thread") {
        const id = (part.data as { threadId?: string } | undefined)?.threadId;
        if (id) {
          setThreadId((cur) => cur ?? id);
          invalidateThreads(qc, workspaceId);
        }
      }
    },
    onFinish: () => {
      // Refresh threads so a brand-new chat (and its generated title) appears.
      invalidateThreads(qc, workspaceId);
    },
  });

  const latestArtifact = useMemo(() => deriveLatestArtifact(messages), [messages]);

  const send = useCallback(
    (text: string, focusFileIds?: string[]) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming" || status === "submitted") return;
      sendMessage(
        { text: trimmed },
        {
          body: {
            threadId,
            modelProfile,
            workspaceId,
            workspaceSlug,
            focusFileIds,
          },
        },
      );
    },
    [sendMessage, status, threadId, modelProfile, workspaceId, workspaceSlug],
  );

  const startNewChat = useCallback(() => {
    stop();
    setMessages([]);
    setThreadId(undefined);
    setOutputsOpen(true);
    setOpenDoc(null);
    closePanelDoc();
    setView("chat");
  }, [setMessages, stop, closePanelDoc]);

  // Load a thread's persisted history into the chat when it's selected.
  const selectThread = useCallback(
    async (id: string) => {
      setThreadId(id);
      setView("chat");
      setOpenDoc(null);
      try {
        const res = await fetch(`/api/agent?threadId=${id}`);
        if (!res.ok) return;
        const { messages: rows } = (await res.json()) as {
          messages: { id: string; role: string; content: string; parts?: unknown }[];
        };
        const mapped = (rows ?? []).map((r) => ({
          id: r.id,
          role: r.role,
          parts:
            Array.isArray(r.parts) && r.parts.length
              ? r.parts
              : [{ type: "text", text: r.content ?? "" }],
        }));
        setMessages(mapped as typeof messages);
      } catch {
        // best-effort; keep whatever is on screen
      }
    },
    [setMessages], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const deleteThread = useCallback(
    async (id: string) => {
      const removed = threads.find((t) => t.id === id);
      setThreadsCache((prev) => prev.filter((t) => t.id !== id)); // optimistic
      if (threadId === id) startNewChat();
      try {
        const res = await fetch(`/api/agent/threads/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
      } catch {
        // Roll back so a failed delete doesn't leave a ghost on next load.
        if (removed) {
          setThreadsCache((prev) =>
            [...prev, removed].sort((a, b) =>
              (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
            ),
          );
          toast.error("Couldn't delete chat");
        }
      }
    },
    [threads, threadId, startNewChat, setThreadsCache],
  );

  const isEmpty = messages.length === 0;
  const navView: RailView | undefined =
    view === "plugins" ? "plugins"
    : view === "folders" || view === "folder-detail" ? "folders"
    : isEmpty && !threadId && view === "chat" ? "new"
    : undefined;

  const isPanel = view !== "chat";
  const panelView =
    view === "plugins" ? <AgentPluginsView />
    : view === "folders" ? (
        <AgentFoldersView
          onOpenFolder={(f) => { closePanelDoc(); setOpenFolder(f); setView("folder-detail"); }}
          onOpenFile={openFileInPanel}
        />
      )
    : view === "folder-detail" && openFolder ? (
        <AgentFolderDetailView
          folder={openFolder}
          onRemove={() => { closePanelDoc(); setView("folders"); }}
          onBack={() => { closePanelDoc(); setView("folders"); }}
          onOpenFile={openFileInPanel}
        />
      )
    : view === "settings" ? <AgentSettingsView />
    : view === "profile" ? <AgentProfileView />
    : null;

  const closeNav = () => setMobileNavOpen(false);

  return (
    <div
      className={`agent-shell-root paper-bg ${mobileNavOpen ? "nav-open" : ""}`}
      style={{ display: "flex", height: "100%" }}
    >
      {/* Mobile top bar — only shown < 768px (CSS) */}
      <div className="mobile-bar">
        <button
          className="iconbtn"
          aria-label="Open navigation menu"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu style={{ width: 20, height: 20 }} aria-hidden />
        </button>
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {workspaceName}
        </span>
        <span style={{ flex: 1 }} />
        <button className="iconbtn" aria-label="New chat" onClick={() => { startNewChat(); closeNav(); }}>
          <SquarePen style={{ width: 18, height: 18 }} aria-hidden />
        </button>
      </div>

      <AgentThreadRail
        workspaceName={workspaceName}
        threads={threads}
        activeThreadId={threadId}
        navView={navView}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onNav={(v) => {
          if (v === "search") setPaletteOpen(true);
          else if (v === "plugins") setView("plugins");
          else if (v === "folders") setView("folders");
          else if (v === "settings") setView("settings");
          else if (v === "profile") setView("profile");
          closeNav();
        }}
        onNewChat={() => { startNewChat(); closeNav(); }}
        onSelectThread={(id) => { selectThread(id); closeNav(); }}
        onDeleteThread={deleteThread}
      />

      {/* Scrim behind the mobile drawer */}
      <div className="rail-scrim" aria-hidden="true" onClick={closeNav} />

      <div className="shell-content">
        {isPanel ? (
          <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
            <main
              className="canvas-panel"
              style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", margin: "8px 8px 8px 0", overflowY: "auto" }}
            >
              {panelView}
            </main>
            {panelDoc && (
              <div style={{ width: "46%", flexShrink: 0, minWidth: 0, display: "flex" }}>
                <AgentDocumentViewer doc={panelDoc} onClose={closePanelDoc} />
              </div>
            )}
          </div>
        ) : (
          <AgentChatSurface
            isEmpty={isEmpty}
            messages={messages}
            status={status}
            modelProfile={modelProfile}
            onModelProfileChange={setModelProfile}
            onSend={send}
            onStop={stop}
            outputsOpen={outputsOpen}
            onToggleOutputs={() => setOutputsOpen((v) => !v)}
            artifact={latestArtifact}
            openDoc={openDoc}
            onToggleDoc={toggleDoc}
            onOpenSource={openSource}
            onConnectApps={() => setView("plugins")}
          />
        )}
      </div>

      {paletteOpen && (
        <AgentSearchPalette
          threads={threads}
          workspaceId={workspaceId}
          onPick={(id) => { setPaletteOpen(false); selectThread(id); }}
          onAsk={(q) => { setPaletteOpen(false); startNewChat(); setTimeout(() => send(q), 50); }}
          onOpenFile={(id, title) => { setPaletteOpen(false); setView("folders"); openFileInPanel(id, title); }}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
