"use client";

import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import {
  ChevronDown,
  ChevronLeft,
  Clock as ClockIcon,
  Workflow,
  MessageSquarePlus,
  Sunrise,
  CalendarCheck,
  RadarIcon,
  Play,
  Pause,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  Network,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { AgentAutomationModal, type AutomationDraft } from "./agent-automation-modal";
import { AgentWorkflowCanvas } from "./agent-workflow-canvas";

type RunStatus = "success" | "running" | "failed";
interface RunRecord {
  id: string;
  at: string; // ISO
  status: RunStatus;
  durationMs: number;
  resultMd: string;
}
interface Automation {
  id: string;
  title: string;
  description: string;
  frequency: string;
  time: string;
  kind: "automation" | "workflow";
  status: "active" | "paused";
  lastRunAt: string | null;
  runs: RunRecord[];
}

const SAMPLE_RESULT = `## Daily tech & AI brief — top stories

**Launches**
- A new YC-backed startup shipped an agentic coding tool; strong early traction on X.
- Product Hunt #1: a workflow-automation app (relevant to our roadmap).

**Model news**
- Two frontier labs published updates to their long-context models.

**People to watch**
- Threads from notable AI builders on eval tooling and memory.

I saved the full report and posted the summary to **#growth** on Slack.`;

function hoursAgo(n: number) { return new Date(Date.now() - n * 3600e3).toISOString(); }

const SEED: Automation[] = [
  {
    id: "a1",
    title: "Daily tech & AI brief",
    description: "Every morning, scour the web (X/Twitter, Product Hunt, YC) for top tech and AI news — launches, model updates, and notable builders — then summarize and post to #growth on Slack.",
    frequency: "Daily", time: "09:00", kind: "workflow", status: "active", lastRunAt: hoursAgo(3),
    runs: [
      { id: "r1", at: hoursAgo(3), status: "success", durationMs: 142000, resultMd: SAMPLE_RESULT },
      { id: "r2", at: hoursAgo(27), status: "success", durationMs: 138000, resultMd: SAMPLE_RESULT },
      { id: "r3", at: hoursAgo(51), status: "failed", durationMs: 9000, resultMd: "Run failed — the search tool timed out. Retried once, then stopped." },
    ],
  },
  {
    id: "a2",
    title: "Weekly growth report",
    description: "Every Monday, draft the weekly growth report from live data and email it to leadership after I approve.",
    frequency: "Weekly", time: "08:00", kind: "automation", status: "paused", lastRunAt: hoursAgo(120),
    runs: [{ id: "r4", at: hoursAgo(120), status: "success", durationMs: 210000, resultMd: "Drafted the weekly report and sent for approval." }],
  },
];

const STARTERS = [
  { icon: Sunrise, tint: "#e8762c", bg: "#fff3e8", label: "Daily brief", desc: "A morning summary of what changed", prompt: "Every morning at 8am, brief me on what changed across the company." },
  { icon: CalendarCheck, tint: "#1fa453", bg: "#e9f7ee", label: "Weekly review", desc: "A weekly report, sent after you approve", prompt: "Every Monday, draft a weekly review from our data and email it after I approve." },
  { icon: RadarIcon, tint: "#0a85ff", bg: "#eaf4ff", label: "Project monitor", desc: "Alerts when projects stall or block", prompt: "Watch my projects and alert me when anything is blocked or stale." },
];

function rel(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDur(ms: number) { const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; }
function to12h(v: string) { const [h, m] = v.split(":").map(Number); const ap = h < 12 ? "AM" : "PM"; const hh = h % 12 === 0 ? 12 : h % 12; return `${hh}:${String(m).padStart(2, "0")} ${ap}`; }

function StatusDot({ status }: { status: RunStatus }) {
  const color = status === "success" ? "var(--green)" : status === "failed" ? "var(--red)" : "var(--blue)";
  return <span style={{ width: 7, height: 7, borderRadius: 999, background: color, display: "inline-block", flexShrink: 0 }} />;
}

function AnimatedClock() {
  return (
    <svg viewBox="0 0 100 100" width="78" height="78" aria-hidden="true">
      <circle cx="50" cy="50" r="33" fill="none" stroke="var(--ink)" strokeWidth="3" />
      <line className="rc-clock-hour" x1="50" y1="50" x2="50" y2="34" stroke="var(--ink)" strokeWidth="3.6" strokeLinecap="round" />
      <line className="rc-clock-min" x1="50" y1="50" x2="50" y2="25" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.6" fill="var(--ink)" />
    </svg>
  );
}

function MenuRow({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", padding: "8px 10px", border: "none", background: "transparent", borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-body)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-soft)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <span style={{ color: "var(--ink-2)", marginTop: 1 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)", marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

/* ————— Detail (two-pane) ————— */
function DetailView({ auto, onBack, onToggleStatus }: { auto: Automation; onBack: () => void; onToggleStatus: () => void }) {
  const [tab, setTab] = useState<"overview" | "canvas">("overview");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runs, setRuns] = useState(auto.runs);
  const [running, setRunning] = useState(false);
  const run = runs.find((r) => r.id === selectedRun) ?? null;

  function runNow() {
    setRunning(true);
    const id = "r" + Math.random().toString(36).slice(2, 6);
    setRuns((prev) => [{ id, at: new Date().toISOString(), status: "running", durationMs: 0, resultMd: "" }, ...prev]);
    setSelectedRun(id);
    setTimeout(() => {
      setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, status: "success", durationMs: 134000, resultMd: SAMPLE_RESULT } : r)));
      setRunning(false);
    }, 2600);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div style={{ height: 48, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", flexShrink: 0 }}>
        <button className="iconbtn" onClick={onBack} aria-label="Back"><ChevronLeft style={{ width: 18, height: 18 }} /></button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{auto.title}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 500, background: auto.status === "active" ? "#e9f7ee" : "#f0f0f0", color: auto.status === "active" ? "#157f3d" : "var(--ink-3)" }}>
          {auto.status === "active" ? "Active" : "Paused"}
        </span>
        <span style={{ flex: 1 }} />
        {/* overview / canvas toggle */}
        <div style={{ display: "flex", gap: 2, background: "var(--hover-soft)", borderRadius: 9, padding: 2 }}>
          {(["overview", "canvas"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 11px", borderRadius: 7, border: "none", background: tab === t ? "var(--bg)" : "transparent", color: tab === t ? "var(--ink)" : "var(--ink-2)", fontSize: 12.5, fontWeight: 500, fontFamily: "var(--font-body)", cursor: "pointer", boxShadow: tab === t ? "var(--shadow-card)" : "none", textTransform: "capitalize" }}>
              {t === "canvas" ? <Network style={{ width: 13, height: 13 }} /> : <FileText style={{ width: 13, height: 13 }} />}
              {t}
            </button>
          ))}
        </div>
        <button className="btn btn-outline" onClick={onToggleStatus} style={{ height: 30, padding: "0 12px", display: "flex", alignItems: "center", gap: 5 }}>
          {auto.status === "active" ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
          {auto.status === "active" ? "Pause" : "Resume"}
        </button>
        <button className="iconbtn" aria-label="More"><MoreHorizontal style={{ width: 18, height: 18 }} /></button>
      </div>

      {tab === "canvas" ? (
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <AgentWorkflowCanvas />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* left: description or run result */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "20px 32px 40px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              {run ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "var(--ink-3)", fontSize: 12.5 }}>
                    <StatusDot status={run.status} />
                    Run · {new Date(run.at).toLocaleString()} {run.status !== "running" && `· ${fmtDur(run.durationMs)}`}
                  </div>
                  {run.status === "running" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-2)", fontSize: 14 }}>
                      <Loader2 className="spin" style={{ width: 16, height: 16 }} /> Running…
                    </div>
                  ) : (
                    <div className="answer-md selectable"><Streamdown mode="static" parseIncompleteMarkdown={false}>{run.resultMd}</Streamdown></div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500, marginBottom: 8 }}>What this does</div>
                  <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink)" }}>{auto.description}</div>
                  <div style={{ marginTop: 18, fontSize: 13.5, color: "var(--ink-2)" }}>
                    Runs <strong style={{ color: "var(--ink)" }}>{auto.frequency.toLowerCase()} at {to12h(auto.time)}</strong>. Select a run on the right to see its results, or run it now.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* right: schedule + run + history */}
          <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--line-soft)" }}>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500, marginBottom: 10 }}>Schedule</div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--ink)" }}>
                <ClockIcon style={{ width: 16, height: 16, color: "var(--ink-2)" }} />
                {auto.frequency} at {to12h(auto.time)}
              </div>
              <button
                type="button"
                onClick={runNow}
                disabled={running}
                style={{ marginTop: 14, width: "100%", height: 36, borderRadius: 10, border: "none", background: "var(--ink)", color: "#fff", fontSize: 13.5, fontWeight: 500, fontFamily: "var(--font-body)", cursor: running ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: running ? 0.7 : 1 }}
              >
                {running ? <Loader2 className="spin" style={{ width: 15, height: 15 }} /> : <Play style={{ width: 14, height: 14, fill: "currentColor" }} />}
                {running ? "Running…" : "Run now"}
              </button>
            </div>
            <div style={{ padding: "14px 12px", flex: 1, minHeight: 0, overflowY: "auto" }}>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500, padding: "0 6px 8px" }}>Runs</div>
              {runs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRun(r.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 8px", borderRadius: 9, border: "none", background: selectedRun === r.id ? "var(--hover-soft)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-body)", transition: "background 0.1s ease" }}
                  onMouseEnter={(e) => { if (selectedRun !== r.id) e.currentTarget.style.background = "var(--hover-soft)"; }}
                  onMouseLeave={(e) => { if (selectedRun !== r.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <StatusDot status={r.status} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink)" }}>{new Date(r.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)" }}>{r.status === "running" ? "running…" : r.status === "failed" ? "failed" : fmtDur(r.durationMs)}</span>
                  </span>
                  {r.status === "success" && <CheckCircle2 style={{ width: 14, height: 14, color: "var(--green)" }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ————— List + Empty + main ————— */
export function AgentAutomationsView({ onCreate }: { onCreate?: (prompt: string) => void }) {
  const [automations, setAutomations] = useState<Automation[]>(SEED);
  const [selected, setSelected] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<{ mode: "automation" | "workflow"; prefill?: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function handleCreate(draft: AutomationDraft) {
    setModal(null);
    const a: Automation = { id: "a" + Math.random().toString(36).slice(2, 6), title: draft.title, description: draft.description, frequency: draft.frequency, time: draft.time, kind: draft.mode, status: "active", lastRunAt: null, runs: [] };
    setAutomations((prev) => [a, ...prev]);
    toast(`${draft.mode === "workflow" ? "Workflow" : "Automation"} created`);
    setSelected(a.id);
  }

  const detail = automations.find((a) => a.id === selected);

  if (detail) {
    return (
      <DetailView
        auto={detail}
        onBack={() => setSelected(null)}
        onToggleStatus={() => setAutomations((prev) => prev.map((a) => (a.id === detail.id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a)))}
      />
    );
  }

  const TopBar = (
    <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 16px", flexShrink: 0 }}>
      <button type="button" onClick={() => toast("Templates coming soon")} style={{ display: "flex", alignItems: "center", height: 32, padding: "0 13px", borderRadius: 9, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)", cursor: "pointer", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f7f7")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg)")}>View templates</button>
      <div ref={menuRef} style={{ position: "relative" }}>
        <button type="button" onClick={() => setMenuOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 13px", borderRadius: 9, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)", cursor: "pointer", border: "none", background: "var(--ink)", color: "#fff" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#000")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink)")}>
          Create manually<ChevronDown style={{ width: 14, height: 14 }} />
        </button>
        {menuOpen && (
          <div className="rise" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 256, background: "var(--bg)", borderRadius: 12, boxShadow: "var(--shadow-pop)", padding: 5, zIndex: 40 }}>
            <MenuRow icon={<ClockIcon style={{ width: 16, height: 16 }} />} label="Create automation" sub="Runs on a schedule, no visual canvas" onClick={() => { setMenuOpen(false); setModal({ mode: "automation" }); }} />
            <MenuRow icon={<Workflow style={{ width: 16, height: 16 }} />} label="Create workflow" sub="A multi-step flow you can watch" onClick={() => { setMenuOpen(false); setModal({ mode: "workflow" }); }} />
            <div style={{ borderTop: "1px solid var(--line)", margin: "4px 6px" }} />
            <MenuRow icon={<MessageSquarePlus style={{ width: 16, height: 16 }} />} label="Create via chat" sub="Describe what to automate in chat" onClick={() => { setMenuOpen(false); onCreate?.("I want to automate "); }} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {TopBar}
      <div style={{ padding: "0 40px" }}>
        <h1 style={{ fontSize: 27, letterSpacing: "-0.02em" }}>Automations</h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 4 }}>Run chats on a schedule or whenever you need them. <button onClick={() => toast("Automations help coming soon")} style={{ color: "var(--blue)", border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, padding: 0 }}>Learn more</button></p>
      </div>

      {automations.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 80 }}>
          <AnimatedClock />
          <div style={{ fontSize: 16.5, fontWeight: 600, marginTop: 22 }}>Create your first automation</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 6 }}>Start from one of these, or describe it in chat.</div>
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            {STARTERS.map((s) => (
              <button key={s.label} type="button" onClick={() => setModal({ mode: "automation", prefill: s.prompt })} style={{ width: 184, display: "flex", flexDirection: "column", alignItems: "flex-start", padding: 14, borderRadius: 14, border: "1px solid var(--line)", background: "var(--bg)", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-body)", transition: "box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,.07), 0 6px 20px -6px rgba(0,0,0,.12)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "transparent"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "var(--line)"; }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: s.bg, color: s.tint, marginBottom: 12 }}><s.icon style={{ width: 17, height: 17 }} /></span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.4 }}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 40px 40px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "var(--bg)", boxShadow: "var(--shadow-card)" }}>
            {automations.map((a) => (
              <button key={a.id} type="button" onClick={() => setSelected(a.id)} className="lrow" style={{ gap: 14 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: a.kind === "workflow" ? "#eaf4ff" : "#f4f4f4", color: a.kind === "workflow" ? "#0a85ff" : "var(--ink-2)", flexShrink: 0 }}>
                  {a.kind === "workflow" ? <Network style={{ width: 17, height: 17 }} /> : <ClockIcon style={{ width: 17, height: 17 }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", height: 18, padding: "0 7px", borderRadius: 999, fontSize: 10.5, fontWeight: 500, background: a.status === "active" ? "#e9f7ee" : "#f0f0f0", color: a.status === "active" ? "#157f3d" : "var(--ink-3)" }}>{a.status}</span>
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{a.frequency} at {to12h(a.time)} · last run {rel(a.lastRunAt)}</span>
                </span>
                <span style={{ fontSize: 12.5, color: "var(--ink-3)", flexShrink: 0 }}>{a.runs.length} run{a.runs.length === 1 ? "" : "s"}</span>
                <ChevronDown style={{ width: 15, height: 15, color: "var(--ink-3)", transform: "rotate(-90deg)", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {modal && <AgentAutomationModal mode={modal.mode} initialDescription={modal.prefill} onClose={() => setModal(null)} onCreate={handleCreate} />}
    </div>
  );
}
