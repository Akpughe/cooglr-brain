"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock, FolderClosed, Info, Layers, Sparkles, X } from "lucide-react";

const FREQUENCIES = ["Hourly", "Daily", "Weekdays", "Weekly", "Custom"] as const;
type Frequency = (typeof FREQUENCIES)[number];

function to12h(v: string): string {
  const [h, m] = v.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function genTimes(): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      out.push({ label: to12h(value), value });
    }
  }
  return out;
}
const TIMES = genTimes();

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "7px 9px",
  borderRadius: 7,
  border: "none",
  background: "transparent",
  color: "var(--ink)",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  textAlign: "left",
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: "var(--ink-3)", fontWeight: 500, padding: "2px 2px 6px" };

function FooterPill({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 9, border: "1px solid var(--line)", background: active ? "var(--hover-soft)" : "var(--bg)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 500, fontFamily: "var(--font-body)", cursor: "pointer", transition: "background 0.12s ease", whiteSpace: "nowrap" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = active ? "var(--hover-soft)" : "var(--bg)")}
    >
      {icon}
      {label}
      <ChevronDown style={{ width: 13, height: 13, opacity: 0.7 }} />
    </button>
  );
}

function ScheduleControl({ freq, setFreq, time, setTime }: { freq: Frequency; setFreq: (f: Frequency) => void; time: string; setTime: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open && timeListRef.current) {
      const sel = timeListRef.current.querySelector("[data-sel='true']") as HTMLElement | null;
      if (sel) timeListRef.current.scrollTop = sel.offsetTop - 60;
    }
  }, [open]);

  const showTime = freq !== "Hourly";
  const label = freq === "Hourly" ? "Hourly" : `${freq} at ${to12h(time)}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <FooterPill icon={<Clock style={{ width: 14, height: 14 }} />} label={label} active={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="rise" style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: 240, background: "var(--bg)", borderRadius: 12, boxShadow: "var(--shadow-pop)", padding: 10, zIndex: 70 }}>
          <div style={labelStyle}>Schedule</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {FREQUENCIES.map((f) => (
              <button key={f} type="button" onClick={() => setFreq(f)} style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-soft)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <span>{f}</span>
                {freq === f && <Check style={{ width: 14, height: 14 }} />}
              </button>
            ))}
          </div>
          {showTime && (
            <>
              <div style={{ borderTop: "1px solid var(--line)", margin: "8px 2px 6px" }} />
              <div style={labelStyle}>Time</div>
              <div ref={timeListRef} style={{ maxHeight: 150, overflowY: "auto" }}>
                {TIMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    data-sel={t.value === time}
                    onClick={() => setTime(t.value)}
                    style={{ ...menuItemStyle, justifyContent: "flex-start", fontVariantNumeric: "tabular-nums", background: t.value === time ? "var(--hover-soft)" : "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-soft)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = t.value === time ? "var(--hover-soft)" : "transparent")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export interface AutomationDraft {
  title: string;
  description: string;
  frequency: Frequency;
  time: string;
  mode: "automation" | "workflow";
}

export function AgentAutomationModal({
  mode,
  initialDescription,
  onClose,
  onCreate,
}: {
  mode: "automation" | "workflow";
  initialDescription?: string;
  onClose: () => void;
  onCreate: (draft: AutomationDraft) => void;
}) {
  const isWorkflow = mode === "workflow";
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState(initialDescription ?? "");
  const [freq, setFreq] = useState<Frequency>("Daily");
  const [time, setTime] = useState("09:00");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ready = desc.trim().length > 0;

  return (
    <>
      <div className="palette-veil" onClick={onClose} />
      <div
        className="rc-modal"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(860px, 92vw)",
          maxHeight: "80vh",
          background: "var(--bg)",
          borderRadius: 16,
          boxShadow: "0 0 0 1px rgba(0,0,0,.06), 0 28px 80px -14px rgba(0,0,0,.32)",
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px" }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isWorkflow ? "Workflow title" : "Automation title"}
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)", padding: 0 }}
          />
          <button type="button" onClick={() => { setTitle(""); setDesc(""); }} style={textBtn}>Clear</button>
          <button type="button" className="iconbtn tip" data-tip="Tips" style={{ width: 26, height: 26 }}><Info style={{ width: 15, height: 15 }} /></button>
          <button type="button" className="btn btn-outline" style={{ height: 28, padding: "0 11px", fontSize: 12.5 }}>Use template</button>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close" style={{ width: 26, height: 26 }}><X style={{ width: 16, height: 16 }} /></button>
        </div>

        {/* description */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 18px" }}>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            autoFocus
            placeholder={
              isWorkflow
                ? "Describe what you want a workflow for — the steps, the tools it should connect, and what it should produce."
                : "Describe what you want to automate — what it should do, which sources or tools to use, and what to produce. It runs on the schedule below without you."
            }
            style={{ width: "100%", minHeight: 220, border: "none", outline: "none", resize: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: 14.5, lineHeight: 1.65, color: "var(--ink)", padding: "4px 0 12px" }}
          />
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px 16px" }}>
          <ScheduleControl freq={freq} setFreq={setFreq} time={time} setTime={setTime} />
          <FooterPill icon={<FolderClosed style={{ width: 14, height: 14 }} />} label="Select project" />
          <FooterPill icon={<Layers style={{ width: 14, height: 14 }} />} label="All sources" />
          <FooterPill icon={<Sparkles style={{ width: 14, height: 14 }} />} label="Auto" />
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={textBtn}>Cancel</button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onCreate({ title: title.trim() || (isWorkflow ? "Untitled workflow" : "Untitled automation"), description: desc.trim(), frequency: freq, time, mode })}
            style={{ height: 32, padding: "0 16px", borderRadius: 9, border: "none", background: ready ? "var(--ink)" : "var(--hover)", color: ready ? "#fff" : "var(--ink-3)", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)", cursor: ready ? "pointer" : "default", transition: "background 0.12s ease" }}
          >
            Create
          </button>
        </div>
      </div>
    </>
  );
}

const textBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--ink-2)",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  padding: "4px 6px",
  borderRadius: 7,
};
