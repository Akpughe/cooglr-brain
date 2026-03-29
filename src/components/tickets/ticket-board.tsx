"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  department: string | null;
  target_repo: string | null;
  ai_triage: Record<string, unknown> | null;
  pr_url: string | null;
  created_at: string;
  created_by: string;
}

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  open: { label: "Open", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  in_progress: { label: "In Progress", color: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  in_review: { label: "In Review", color: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  done: { label: "Done", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  closed: { label: "Closed", color: "text-muted-foreground", dot: "bg-muted-foreground/40" },
};

const PRIORITY_META: Record<string, { label: string; color: string; icon: string }> = {
  critical: { label: "Critical", color: "text-red-600", icon: "!!!" },
  high: { label: "High", color: "text-orange-600 dark:text-orange-400", icon: "!!" },
  medium: { label: "Medium", color: "text-amber-600 dark:text-amber-400", icon: "!" },
  low: { label: "Low", color: "text-muted-foreground", icon: "-" },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  bug: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500/70">
      <path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>
    </svg>
  ),
  feature: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500/70">
      <path d="M12 3 2 12h5v8h10v-8h5Z"/>
    </svg>
  ),
  task: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500/70">
      <rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  improvement: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500/70">
      <path d="M12 20V10"/><path d="m18 14-6-6-6 6"/>
    </svg>
  ),
};

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
];

export function TicketBoard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("bug");
  const [priority, setPriority] = useState("medium");
  const [creating, setCreating] = useState(false);
  const [repos, setRepos] = useState<{ full_name: string; owner: { login: string }; name: string }[]>([]);
  const [targetRepo, setTargetRepo] = useState("");

  const loadTickets = useCallback(async () => {
    const url = filter === "all" ? "/api/tickets" : `/api/tickets?status=${encodeURIComponent(filter)}`;
    const res = await fetch(url);
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadTickets();
    fetch("/api/github/repos").then((r) => (r.ok ? r.json() : [])).then(setRepos).catch(() => {});
  }, [loadTickets]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, type, priority, target_repo: targetRepo && targetRepo !== "none" ? targetRepo : null }),
    });
    if (res.ok) {
      setTitle("");
      setDescription("");
      setType("bug");
      setPriority("medium");
      setTargetRepo("");
      setShowCreate(false);
      loadTickets();
    }
    setCreating(false);
  }

  async function updateStatus(ticketId: string, status: string) {
    await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticketId, status }),
    });
    loadTickets();
  }

  // Count by status for tab badges
  const counts: Record<string, number> = {};
  tickets.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">Tickets</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Loading..." : `${tickets.length} ticket${tickets.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger>
              <button className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors duration-150 shadow-surface">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Ticket
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Ticket</DialogTitle>
              </DialogHeader>
              <form onSubmit={createTicket} className="space-y-4 mt-2">
                <Input
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="rounded-lg"
                />
                <Textarea
                  placeholder="Describe the issue or request..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="rounded-lg"
                />
                <div className="flex gap-2">
                  <Select value={type} onValueChange={(v) => v && setType(v)}>
                    <SelectTrigger className="w-[130px] rounded-lg h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="improvement">Improvement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                    <SelectTrigger className="w-[130px] rounded-lg h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={targetRepo} onValueChange={(v) => v && setTargetRepo(v)}>
                  <SelectTrigger className="w-full rounded-lg h-9 text-[13px]">
                    <SelectValue placeholder="Target repository (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific repo</SelectItem>
                    {repos.map((r) => (
                      <SelectItem key={r.full_name} value={r.full_name}>{r.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" className="w-full rounded-lg" disabled={creating}>
                  {creating ? "Creating..." : "Create Ticket"}
                </Button>
                <p className="text-[11px] text-muted-foreground/60 text-center">
                  AI will automatically triage after creation
                </p>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 overflow-x-auto">
          {FILTER_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] whitespace-nowrap transition-all duration-100",
                filter === t.value
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {t.label}
              {t.value !== "all" && counts[t.value] ? (
                <span className="text-[10px] tabular-nums text-muted-foreground">{counts[t.value]}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-5 h-5 rounded skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 skeleton" style={{ width: `${35 + i * 10}%` }} />
                  <div className="h-2.5 skeleton" style={{ width: `${20 + i * 5}%` }} />
                </div>
                <div className="h-5 w-20 skeleton shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Ticket list */}
        {!loading && tickets.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-surface">
            {tickets.map((ticket, i) => {
              const statusMeta = STATUS_META[ticket.status] || STATUS_META.open;
              const priorityMeta = PRIORITY_META[ticket.priority] || PRIORITY_META.medium;
              const expanded = expandedId === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className={cn(
                    i < tickets.length - 1 && "border-b border-border"
                  )}
                >
                  <div
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors duration-100 cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : ticket.id)}
                  >
                    {/* Type icon */}
                    <div className="shrink-0">
                      {TYPE_ICONS[ticket.type] || TYPE_ICONS.task}
                    </div>

                    {/* Priority indicator */}
                    <div className={cn("text-[11px] font-bold w-5 text-center shrink-0 tabular-nums", priorityMeta.color)}>
                      {priorityMeta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{ticket.title}</p>
                      {ticket.description && !expanded && (
                        <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5 max-w-[480px]">{ticket.description}</p>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 shrink-0">
                      {ticket.ai_triage && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/8 text-primary border border-primary/15">
                          AI Triaged
                        </span>
                      )}
                      {ticket.pr_url && (
                        <a
                          href={ticket.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/15 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          PR
                        </a>
                      )}
                      <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                        {timeAgo(ticket.created_at)}
                      </span>

                      {/* Status selector */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select value={ticket.status} onValueChange={(v) => { if (v) updateStatus(ticket.id, v); }}>
                          <SelectTrigger className="h-7 w-[120px] text-[11px] rounded-md border-border/60 bg-transparent">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
                              <span className={statusMeta.color}>{statusMeta.label}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_META).map(([value, meta]) => (
                              <SelectItem key={value} value={value}>
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                                  {meta.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expand chevron */}
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={cn(
                          "text-muted-foreground/30 transition-transform duration-150",
                          expanded && "rotate-180"
                        )}
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="px-5 pb-4 pt-0 ml-[72px]">
                      {ticket.description && (
                        <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                          {ticket.description}
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60 mb-3">
                        <span>Type: <span className="text-foreground/70">{ticket.type}</span></span>
                        <span>Priority: <span className={priorityMeta.color}>{priorityMeta.label}</span></span>
                        {ticket.target_repo && (
                          <span>Repo: <span className="text-foreground/70 font-mono text-[10px]">{ticket.target_repo}</span></span>
                        )}
                        <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* AI Triage */}
                      {ticket.ai_triage && (
                        <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 mb-2">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                            </svg>
                            <span className="text-[12px] font-medium text-foreground">AI Triage</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-[11px]">
                            <div>
                              <span className="text-muted-foreground/60 block mb-0.5">Area</span>
                              <span className="text-foreground/80">{(ticket.ai_triage as Record<string, string>).likely_area || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-0.5">Suggested Repo</span>
                              <span className="text-foreground/80 font-mono text-[10px]">{(ticket.ai_triage as Record<string, string>).suggested_repo || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-0.5">Suggested Priority</span>
                              <span className="text-foreground/80">{(ticket.ai_triage as Record<string, string>).suggested_priority || "—"}</span>
                            </div>
                          </div>
                          {(ticket.ai_triage as Record<string, string>).root_cause_hypothesis && (
                            <div className="text-[11px]">
                              <span className="text-muted-foreground/60 block mb-0.5">Root Cause</span>
                              <span className="text-foreground/80">{(ticket.ai_triage as Record<string, string>).root_cause_hypothesis}</span>
                            </div>
                          )}
                          {(ticket.ai_triage as Record<string, string[]>).suggested_next_steps?.length > 0 && (
                            <div className="text-[11px]">
                              <span className="text-muted-foreground/60 block mb-1">Next Steps</span>
                              <div className="space-y-1">
                                {(ticket.ai_triage as Record<string, string[]>).suggested_next_steps.map((step, si) => (
                                  <div key={si} className="flex items-start gap-2 text-foreground/80">
                                    <span className="text-muted-foreground/40 mt-px">{si + 1}.</span>
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && tickets.length === 0 && (
          <div className="rounded-2xl border border-border bg-card py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              {filter === "all" ? "No tickets yet" : `No ${filter.replace("_", " ")} tickets`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filter === "all" ? "Create a ticket to get started" : "Try a different filter"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
