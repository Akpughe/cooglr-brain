"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  is_test: boolean;
  scheduled_at: string | null;
  scheduled_timezone: string | null;
  started_at: string | null;
  completed_at: string | null;
  from_email: string;
  from_name: string | null;
  stats: Record<string, number>;
  created_at: string;
  audience: { id: string; name: string; contact_count: number } | null;
  template: { id: string; name: string } | null;
  provider: { id: string; name: string; display_name: string } | null;
}

interface TemplateOption { id: string; name: string; subject: string; updated_at: string; }
interface AudienceOption { id: string; name: string; contact_count: number; source_type: string; }
interface ProviderOption { id: string; name: string; display_name: string | null; from_email: string; from_name: string | null; }

const STATUS_META: Record<string, { label: string; dot: string; bg: string }> = {
  draft: { label: "Draft", dot: "bg-muted-foreground/40", bg: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", dot: "bg-blue-500", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  sending: { label: "Sending", dot: "bg-amber-500 animate-pulse", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  sent: { label: "Sent", dot: "bg-emerald-500", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  paused: { label: "Paused", dot: "bg-red-500", bg: "bg-red-500/10 text-red-600 dark:text-red-400" },
  failed: { label: "Failed", dot: "bg-red-500", bg: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

const FILTER_TABS = ["All", "Drafts", "Scheduled", "Sent"];

export function CampaignsView() {
  const [filter, setFilter] = useState("All");
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadCampaigns = useCallback(() => {
    fetch("/api/emails/campaigns")
      .then((r) => r.json())
      .then((data) => { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  async function sendCampaign(id: string) {
    setSendingId(id);
    const res = await fetch("/api/emails/campaigns/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: id }),
    });
    const data = await res.json();
    setSendingId(null);
    if (data.errorDetails) alert(`Send errors:\n${data.errorDetails.join("\n")}`);
    loadCampaigns();
  }

  const filterMap: Record<string, string | null> = {
    All: null, Drafts: "draft", Scheduled: "scheduled", Sent: "sent",
  };
  const filtered = filterMap[filter]
    ? campaigns.filter((c) => c.status === filterMap[filter])
    : campaigns;

  if (showCreateFlow || editingCampaign) {
    return (
      <CampaignCreateFlow
        editCampaign={editingCampaign}
        onClose={() => { setShowCreateFlow(false); setEditingCampaign(null); loadCampaigns(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          {FILTER_TABS.map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={cn("h-8 px-3 rounded-lg text-[12px] transition-all duration-100",
                filter === t ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}>{t}</button>
          ))}
        </div>
        <button onClick={() => setShowCreateFlow(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors shadow-surface">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Campaign
        </button>
      </div>

      {loading && <div className="py-20 text-center text-[13px] text-muted-foreground">Loading campaigns...</div>}

      {!loading && filtered.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-surface">
          <div className="grid grid-cols-[1fr_140px_100px_100px_80px] gap-4 px-5 py-2.5 border-b border-border text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            <span>Campaign</span><span>Audience</span><span>Open Rate</span><span>Click Rate</span><span>Status</span>
          </div>
          {filtered.map((c, i) => {
            const meta = STATUS_META[c.status] || STATUS_META.draft;
            const s = (c.stats || {}) as Record<string, number>;
            const sent = s.sent || 0;
            const opened = s.opened || 0;
            const clicked = s.clicked || 0;
            const bounced = s.bounced || 0;
            const delivered = s.delivered || 0;
            const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
            const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
            const expanded = expandedId === c.id;
            return (
              <div key={c.id} className={cn(i < filtered.length - 1 && "border-b border-border")}>
                <div onClick={() => setExpandedId(expanded ? null : c.id)}
                  className="grid grid-cols-[1fr_140px_100px_100px_80px_24px] gap-4 items-center px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{c.subject}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-foreground/80 truncate">{c.audience?.name || c.is_test ? "Test" : "—"}</p>
                    <p className="text-[10px] text-muted-foreground/50 tabular-nums">{c.is_test ? `${(c.stats as Record<string,number>)?.total || 0} test` : `${c.audience?.contact_count?.toLocaleString() || 0} contacts`}</p>
                  </div>
                  <div>{sent > 0 ? <div className="flex items-center gap-2"><div className="w-10 h-1 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${openRate}%` }}/></div><span className="text-[12px] text-foreground/80 tabular-nums">{openRate}%</span></div> : <span className="text-[11px] text-muted-foreground/40">—</span>}</div>
                  <div>{sent > 0 ? <div className="flex items-center gap-2"><div className="w-10 h-1 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${clickRate}%` }}/></div><span className="text-[12px] text-foreground/80 tabular-nums">{clickRate}%</span></div> : <span className="text-[11px] text-muted-foreground/40">—</span>}</div>
                  <div><span className={cn("inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md", meta.bg)}><span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)}/>{meta.label}</span></div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={cn("text-muted-foreground/30 transition-transform duration-150 shrink-0", expanded && "rotate-180")}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
                {/* Expanded detail panel */}
                {expanded && (
                  <div className="px-5 pb-5 pt-1">
                    <div className="rounded-xl bg-muted/20 border border-border/50 p-5 space-y-4">
                      {/* Stats grid */}
                      <div className="grid grid-cols-6 gap-3">
                        <StatBox label="Total" value={s.total || 0} />
                        <StatBox label="Sent" value={sent} />
                        <StatBox label="Delivered" value={delivered} color="text-blue-600 dark:text-blue-400" />
                        <StatBox label="Opened" value={opened} color="text-emerald-600 dark:text-emerald-400" />
                        <StatBox label="Clicked" value={clicked} color="text-violet-600 dark:text-violet-400" />
                        <StatBox label="Bounced" value={bounced} color={bounced > 0 ? "text-red-600 dark:text-red-400" : undefined} />
                      </div>

                      {/* Detail rows */}
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/60">From</span>
                          <span className="text-foreground/80">{c.from_name ? `${c.from_name} <${c.from_email}>` : c.from_email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/60">Template</span>
                          <span className="text-foreground/80">{c.template?.name || "None"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/60">Mode</span>
                          <span className={c.is_test ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>{c.is_test ? "Test" : "Live"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/60">Provider</span>
                          <span className="text-foreground/80">{c.provider?.display_name || c.provider?.name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/60">Created</span>
                          <span className="text-foreground/80 tabular-nums">{new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                        {c.completed_at && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground/60">Completed</span>
                            <span className="text-foreground/80 tabular-nums">{new Date(c.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                          </div>
                        )}
                        {c.scheduled_at && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground/60">Scheduled</span>
                            <span className="text-foreground/80 tabular-nums">{new Date(c.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} {c.scheduled_timezone || ""}</span>
                          </div>
                        )}
                      </div>

                      {/* Delivery funnel bar */}
                      {sent > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] text-muted-foreground/60">Delivery funnel</p>
                          <div className="flex items-center gap-1 h-2">
                            <div className="h-full rounded-full bg-foreground/15 flex-1" title={`Sent: ${sent}`}/>
                            {delivered > 0 && <div className="h-full rounded-full bg-blue-500/40" style={{ flex: delivered / sent }} title={`Delivered: ${delivered}`}/>}
                            {opened > 0 && <div className="h-full rounded-full bg-emerald-500/50" style={{ flex: opened / sent }} title={`Opened: ${opened}`}/>}
                            {clicked > 0 && <div className="h-full rounded-full bg-violet-500/60" style={{ flex: clicked / sent }} title={`Clicked: ${clicked}`}/>}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        {/* Send / Resend */}
                        {(c.status === "draft" || c.status === "failed" || (c.is_test && c.status === "sent")) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); sendCampaign(c.id); }}
                            disabled={sendingId === c.id}
                            className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {sendingId === c.id ? "Sending..." : c.is_test && c.status === "sent" ? "Send Test Again" : c.status === "failed" ? "Retry Send" : "Send Now"}
                          </button>
                        )}
                        {/* Edit */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingCampaign(c); }}
                          className="h-7 px-3 rounded-md text-[11px] text-foreground/70 hover:text-foreground hover:bg-muted/50 border border-border transition-colors"
                        >
                          Edit
                        </button>
                        {/* Delete */}
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("Delete this campaign?")) return;
                          await fetch("/api/emails/campaigns", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: c.id }),
                          });
                          setExpandedId(null);
                          loadCampaigns();
                        }} className="h-7 px-3 rounded-md text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <p className="text-[15px] font-medium text-foreground">Create your first campaign</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-[340px] mx-auto">Design email templates, build your audience, and send targeted campaigns.</p>
          <button onClick={() => setShowCreateFlow(true)} className="mt-5 h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">Get Started</button>
        </div>
      )}
    </div>
  );
}

/* ======== Campaign Create Flow ======== */

const STEPS = ["Setup", "Template", "Audience", "Review"];
const INPUT = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40";

function CampaignCreateFlow({ editCampaign, onClose }: { editCampaign?: Campaign | null; onClose: () => void }) {
  const isEditing = !!editCampaign;
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: Setup
  const [name, setName] = useState(editCampaign?.name || "");
  const [subject, setSubject] = useState(editCampaign?.subject || "");
  const [fromName, setFromName] = useState(editCampaign?.from_name || "");
  const [replyTo, setReplyTo] = useState("");
  const [isTest, setIsTest] = useState(editCampaign?.is_test ?? true);
  const [testRecipients, setTestRecipients] = useState(() => {
    if (!editCampaign?.is_test) return "";
    const raw = (editCampaign as unknown as { test_recipients?: string[] }).test_recipients;
    return Array.isArray(raw) ? raw.join(", ") : "";
  });

  // Step 1: Template
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(editCampaign?.template?.id || null);

  // Step 2: Audience
  const [audiences, setAudiences] = useState<AudienceOption[]>([]);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(editCampaign?.audience?.id || null);

  // Step 3: Review / Schedule
  const [sendOption, setSendOption] = useState<"now" | "schedule">(editCampaign?.scheduled_at ? "schedule" : "now");
  const [scheduleDate, setScheduleDate] = useState(editCampaign?.scheduled_at ? editCampaign.scheduled_at.split("T")[0] : "");
  const [scheduleTime, setScheduleTime] = useState(
    editCampaign?.scheduled_at ? editCampaign.scheduled_at.split("T")[1]?.substring(0, 5) || "09:00" : "09:00"
  );
  const [timezone, setTimezone] = useState(() => {
    if (editCampaign?.scheduled_timezone) return editCampaign.scheduled_timezone;
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  });

  // Provider
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  // Fetch data on mount
  useEffect(() => {
    fetch("/api/emails/templates").then((r) => r.json()).then((d) => setTemplates(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/emails/audiences").then((r) => r.json()).then((d) => setAudiences(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/emails/providers").then((r) => r.json()).then((d) => {
      const list = Array.isArray(d) ? d : [];
      setProviders(list);
      if (!isEditing && list[0]) {
        setFromName(list[0].from_name || "");
        setReplyTo(list[0].from_email || "");
      }
    }).catch(() => {});
  }, [isEditing]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedAudience = audiences.find((a) => a.id === selectedAudienceId);
  const provider = providers[0]; // default provider

  async function handleSubmit() {
    if (!name || !subject) { setError("Campaign name and subject are required"); return; }
    if (!provider) { setError("No email provider configured. Add one in Settings."); return; }
    if (!isTest && !selectedAudienceId) { setError("Select an audience for live mode"); return; }

    setSending(true);
    setError(null);

    try {
      let scheduledAt: string | null = null;
      if (sendOption === "schedule" && scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      }

      const payload = {
        name,
        subject,
        templateId: selectedTemplateId,
        audienceId: selectedAudienceId,
        providerId: provider.id,
        fromName,
        fromEmail: provider.from_email,
        replyTo: replyTo || provider.from_email,
        isTest,
        testRecipients: isTest ? testRecipients.split(",").map((e) => e.trim()).filter(Boolean) : [],
        scheduledAt,
        scheduledTimezone: sendOption === "schedule" ? timezone : null,
      };

      let campaignId: string;

      if (isEditing && editCampaign) {
        // Update existing campaign
        const updateRes = await fetch("/api/emails/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editCampaign.id, ...payload, status: scheduledAt ? "scheduled" : "draft" }),
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok) { setError(updateData.error); setSending(false); return; }
        campaignId = editCampaign.id;
      } else {
        // Create new campaign
        const createRes = await fetch("/api/emails/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const createData = await createRes.json();
        if (!createRes.ok) { setError(createData.error); setSending(false); return; }
        campaignId = createData.id;
      }

      // If "send now", trigger send
      if (sendOption === "now") {
        const sendRes = await fetch("/api/emails/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) { setError(sendData.error); setSending(false); return; }
        if (sendData.errorDetails?.length) {
          alert(`Sent ${sendData.sent}/${sendData.total}\n\nErrors:\n${sendData.errorDetails.join("\n")}`);
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
      setSending(false);
    }
  }

  const canContinue = () => {
    if (step === 0) return name.trim() && subject.trim();
    if (step === 1) return !!selectedTemplateId;
    if (step === 2) return isTest ? testRecipients.trim().length > 0 : !!selectedAudienceId;
    return true;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <h2 className="text-[15px] font-medium text-foreground">{isEditing ? "Edit Campaign" : "New Campaign"}</h2>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button onClick={() => i <= step && setStep(i)}
              className={cn("flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] transition-all",
                i === step ? "bg-primary/10 text-primary font-medium" : i < step ? "text-foreground/80 hover:bg-muted/40" : "text-muted-foreground/40 cursor-default"
              )}>
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground/40"
              )}>
                {i < step ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <div className={cn("w-8 h-px", i < step ? "bg-emerald-500/30" : "bg-border")}/>}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-border bg-card shadow-surface">
        {/* Step 0: Setup */}
        {step === 0 && (
          <div className="p-6 space-y-5">
            <div>
              <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Campaign Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. March Newsletter" className={INPUT} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Subject Line</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Your weekly update is here" className={INPUT} />
              <p className="text-[11px] text-muted-foreground/50 mt-1">Tip: Keep under 50 characters for best open rates</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">From Name</label>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="e.g. Your Company" className={INPUT} />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Reply-To</label>
                <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="e.g. hello@company.com" className={INPUT} />
              </div>
            </div>
            {/* Test/Live toggle */}
            <div className="rounded-xl bg-muted/30 border border-border/50 p-4">
              <label className="text-[12px] font-medium text-foreground/80 block mb-3">Send Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ key: true, label: "Test Mode", desc: "Send to test addresses only", icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, color: "text-amber-600" },
                  { key: false, label: "Live Mode", desc: "Send to full audience", icon: <><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>, color: "text-emerald-600" }
                ].map((mode) => (
                  <button key={String(mode.key)} type="button" onClick={() => setIsTest(mode.key)}
                    className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                      isTest === mode.key ? "border-2 border-primary bg-primary/5" : "border border-border hover:border-primary/20"
                    )}>
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={mode.color}>{mode.icon}</svg>
                    </div>
                    <div><p className="text-[13px] font-medium text-foreground">{mode.label}</p><p className="text-[11px] text-muted-foreground">{mode.desc}</p></div>
                  </button>
                ))}
              </div>
              {isTest && (
                <div className="mt-3">
                  <label className="text-[11px] text-muted-foreground/60 block mb-1">Test email addresses (comma-separated)</label>
                  <input value={testRecipients} onChange={(e) => setTestRecipients(e.target.value)} placeholder="you@example.com, colleague@example.com" className={INPUT} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Template */}
        {step === 1 && (
          <div className="p-6">
            <label className="text-[12px] font-medium text-foreground/80 block mb-4">Choose a template</label>
            {templates.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-muted-foreground">No templates yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Create one in the Templates tab first</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setSelectedTemplateId(t.id)}
                    className={cn("rounded-xl border p-4 text-left transition-all duration-150",
                      selectedTemplateId === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/20"
                    )}>
                    <div className="aspect-[4/3] rounded-lg bg-muted/50 mb-3 flex items-center justify-center overflow-hidden">
                      <div className="w-full px-3 space-y-1.5">
                        <div className="h-2 bg-muted-foreground/10 rounded w-1/2 mx-auto"/>
                        <div className="h-1.5 bg-muted-foreground/5 rounded w-3/4 mx-auto"/>
                        <div className="h-1.5 bg-muted-foreground/5 rounded w-2/3 mx-auto"/>
                        <div className="h-4 bg-primary/10 rounded-md w-1/3 mx-auto mt-2"/>
                      </div>
                    </div>
                    <p className="text-[13px] font-medium text-foreground">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.subject || "No subject"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <div className="p-6">
            {isTest ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <p className="text-[13px] font-medium text-foreground">Test Mode</p>
                <p className="text-[11px] text-muted-foreground mt-1">Emails will be sent to your test addresses only:</p>
                <p className="text-[12px] text-foreground mt-2 font-mono">{testRecipients || "No test emails set"}</p>
                <button onClick={() => setStep(0)} className="mt-3 text-[12px] text-primary hover:underline">Edit test addresses</button>
              </div>
            ) : (
              <>
                <label className="text-[12px] font-medium text-foreground/80 block mb-4">Select audience</label>
                {audiences.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-[13px] text-muted-foreground">No audiences yet</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Create one in the Audiences tab first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {audiences.map((aud) => (
                      <button key={aud.id} onClick={() => setSelectedAudienceId(aud.id)}
                        className={cn("w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all",
                          selectedAudienceId === aud.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/20"
                        )}>
                        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground">{aud.name}</p>
                          <p className="text-[11px] text-muted-foreground/60">{aud.contact_count.toLocaleString()} contacts</p>
                        </div>
                        {selectedAudienceId === aud.id && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <p className="text-[12px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-4">Campaign Summary</p>
            <div className="grid grid-cols-2 gap-4">
              <ReviewField label="Campaign" value={name} />
              <ReviewField label="Subject" value={isTest ? `[TEST] ${subject}` : subject} />
              <ReviewField label="From" value={`${fromName || provider?.from_name || "—"} <${provider?.from_email || "—"}>`} />
              <ReviewField label="Reply-To" value={replyTo || provider?.from_email || "—"} />
              <ReviewField label="Template" value={selectedTemplate?.name || "None selected"} />
              <ReviewField label="Audience" value={isTest ? `Test: ${testRecipients}` : `${selectedAudience?.name || "—"} (${selectedAudience?.contact_count?.toLocaleString() || 0} contacts)`} />
            </div>

            {/* Mode indicator */}
            <div className={cn("rounded-xl border p-4 flex items-center justify-between",
              isTest ? "bg-amber-500/5 border-amber-500/20" : "bg-emerald-500/5 border-emerald-500/20"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isTest ? "bg-amber-500/10" : "bg-emerald-500/10")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isTest ? "text-amber-600" : "text-emerald-600"}>
                    {isTest ? <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/> : <><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>}
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{isTest ? "Test Mode" : "Live Mode"}</p>
                  <p className="text-[11px] text-muted-foreground">{isTest ? "Sending to test addresses only" : `Sending to ${selectedAudience?.contact_count?.toLocaleString() || 0} contacts`}</p>
                </div>
              </div>
              <button onClick={() => { setIsTest(!isTest); setStep(0); }} className="text-[12px] text-primary hover:underline">
                Switch to {isTest ? "Live" : "Test"}
              </button>
            </div>

            {/* Schedule */}
            <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-4">
              <label className="text-[12px] font-medium text-foreground/80 block">When to send</label>
              <div className="grid grid-cols-2 gap-2">
                {(["now", "schedule"] as const).map((opt) => (
                  <button key={opt} onClick={() => setSendOption(opt)}
                    className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all",
                      sendOption === opt ? "border-2 border-primary bg-primary/5" : "border border-border hover:border-primary/20"
                    )}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={sendOption === opt ? "text-primary" : "text-muted-foreground"}>
                      {opt === "now" ? <polygon points="5 3 19 12 5 21 5 3"/> : <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                    </svg>
                    <span className="text-[12px] font-medium text-foreground">{opt === "now" ? "Send now" : "Schedule"}</span>
                  </button>
                ))}
              </div>
              {sendOption === "schedule" && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[11px] text-muted-foreground/60 block mb-1">Date</label><input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className={INPUT}/></div>
                    <div><label className="text-[11px] text-muted-foreground/60 block mb-1">Time</label><input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className={INPUT}/></div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground/60 block mb-1">Timezone</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cn(INPUT, "appearance-none cursor-pointer")}>
                      {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-[12px] text-destructive">{error}</p>}

            {!provider && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-[12px] text-destructive">No email provider configured. <a href="/settings" className="underline">Add one in Settings</a></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-5">
        <button onClick={() => step > 0 ? setStep(step - 1) : onClose()}
          className="h-9 px-4 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < 3 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canContinue()}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-all shadow-surface disabled:opacity-40">
            Continue
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={sending || !provider}
            className={cn("h-9 px-5 rounded-lg text-[13px] font-medium transition-all shadow-surface text-white disabled:opacity-40",
              sendOption === "schedule" ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"
            )}>
            {sending ? "Saving..." : sendOption === "schedule" ? "Schedule Campaign" : isTest ? (isEditing ? "Save & Send Test" : "Send Test") : (isEditing ? "Save & Send" : "Send Campaign")}
          </button>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn("text-[18px] font-semibold tabular-nums leading-none", color || "text-foreground")}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-1">{label}</p>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] text-muted-foreground/60 block mb-0.5">{label}</span>
      <span className="text-[13px] text-foreground">{value}</span>
    </div>
  );
}

const TIMEZONES = [
  { value: "Pacific/Honolulu", label: "(GMT-10:00) Hawaii" },
  { value: "America/Anchorage", label: "(GMT-09:00) Alaska" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) Pacific Time (US)" },
  { value: "America/Denver", label: "(GMT-07:00) Mountain Time (US)" },
  { value: "America/Chicago", label: "(GMT-06:00) Central Time (US)" },
  { value: "America/New_York", label: "(GMT-05:00) Eastern Time (US)" },
  { value: "America/Halifax", label: "(GMT-04:00) Atlantic Time (Canada)" },
  { value: "America/Sao_Paulo", label: "(GMT-03:00) São Paulo" },
  { value: "UTC", label: "(GMT+00:00) UTC" },
  { value: "Europe/London", label: "(GMT+00:00) London" },
  { value: "Europe/Paris", label: "(GMT+01:00) Paris, Berlin, Rome" },
  { value: "Africa/Lagos", label: "(GMT+01:00) Lagos, West Africa" },
  { value: "Africa/Cairo", label: "(GMT+02:00) Cairo" },
  { value: "Africa/Johannesburg", label: "(GMT+02:00) Johannesburg" },
  { value: "Africa/Nairobi", label: "(GMT+03:00) Nairobi, East Africa" },
  { value: "Europe/Moscow", label: "(GMT+03:00) Moscow" },
  { value: "Asia/Dubai", label: "(GMT+04:00) Dubai" },
  { value: "Asia/Kolkata", label: "(GMT+05:30) Mumbai, Delhi" },
  { value: "Asia/Bangkok", label: "(GMT+07:00) Bangkok, Jakarta" },
  { value: "Asia/Shanghai", label: "(GMT+08:00) Beijing, Shanghai" },
  { value: "Asia/Singapore", label: "(GMT+08:00) Singapore" },
  { value: "Asia/Tokyo", label: "(GMT+09:00) Tokyo" },
  { value: "Australia/Sydney", label: "(GMT+11:00) Sydney" },
  { value: "Pacific/Auckland", label: "(GMT+12:00) Auckland" },
];
