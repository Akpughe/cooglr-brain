"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface PR {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  user: { login: string };
  head: { ref: string };
  base: { ref: string };
  draft: boolean;
}

interface Issue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  user: { login: string };
  labels: { name: string; color: string }[];
}

export function RepoDetail({ owner, repo }: { owner: string; repo: string }) {
  const [pulls, setPulls] = useState<PR[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueBody, setIssueBody] = useState("");
  const [tab, setTab] = useState<"prs" | "issues">("prs");

  const load = useCallback(async () => {
    setLoading(true);
    const [prRes, issueRes] = await Promise.all([
      fetch(`/api/github/pulls?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`),
      fetch(`/api/github/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`),
    ]);
    if (prRes.ok) setPulls(await prRes.json());
    if (issueRes.ok) {
      const allIssues = await issueRes.json();
      setIssues(allIssues.filter((i: { pull_request?: unknown }) => !i.pull_request));
    }
    setLoading(false);
  }, [owner, repo]);

  useEffect(() => { load(); }, [load]);

  async function handleMerge(number: number) {
    setActionLoading(`merge-${number}`);
    const res = await fetch("/api/github/pulls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "merge", owner, repo, number }),
    });
    if (res.ok) load();
    else alert((await res.json()).error);
    setActionLoading(null);
  }

  async function handleCreateIssue(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/github/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, title: issueTitle, body: issueBody }),
    });
    if (res.ok) {
      setIssueTitle("");
      setIssueBody("");
      setShowCreate(false);
      load();
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <a href="/repos" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors mb-3 group">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform duration-150">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back to repos
          </a>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                <span className="text-muted-foreground/50">{owner}/</span>{repo}
              </h1>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger>
                <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-border text-[12px] font-medium text-foreground hover:border-primary/25 hover:bg-muted/40 transition-all duration-150">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New Issue
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create issue on {repo}</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateIssue} className="space-y-3 mt-2">
                  <Input placeholder="Issue title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} required className="rounded-lg" />
                  <Textarea placeholder="Description (optional)..." value={issueBody} onChange={(e) => setIssueBody(e.target.value)} rows={4} className="rounded-lg" />
                  <Button type="submit" className="w-full rounded-lg">Create Issue</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-border mb-5">
          <button
            onClick={() => setTab("prs")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-[13px] border-b-2 -mb-px transition-colors duration-100",
              tab === "prs"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/>
            </svg>
            Pull Requests
            <span className={cn(
              "text-[11px] px-1.5 py-0.5 rounded-md tabular-nums",
              tab === "prs" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {pulls.length}
            </span>
          </button>
          <button
            onClick={() => setTab("issues")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-[13px] border-b-2 -mb-px transition-colors duration-100",
              tab === "issues"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Issues
            <span className={cn(
              "text-[11px] px-1.5 py-0.5 rounded-md tabular-nums",
              tab === "issues" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {issues.length}
            </span>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-5 h-5 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 skeleton" style={{ width: `${40 + i * 12}%` }} />
                  <div className="h-2.5 skeleton" style={{ width: `${25 + i * 8}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pull Requests */}
        {!loading && tab === "prs" && (
          <>
            {pulls.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card py-14 text-center">
                <p className="text-sm text-muted-foreground">No open pull requests</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-surface">
                {pulls.map((pr, i) => (
                  <div
                    key={pr.number}
                    className={cn(
                      "group flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors duration-100",
                      i < pulls.length - 1 && "border-b border-border"
                    )}
                  >
                    {/* PR icon */}
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                      pr.draft ? "text-muted-foreground/40" : "text-emerald-500"
                    )}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/>
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground truncate">{pr.title}</span>
                        {pr.draft && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0">Draft</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground/60">
                        <span>#{pr.number}</span>
                        <span className="text-muted-foreground/20">&middot;</span>
                        <span>{pr.user.login}</span>
                        <span className="text-muted-foreground/20">&middot;</span>
                        <span className="font-mono text-[10px]">{pr.head.ref}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
                          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                        </svg>
                        <span className="font-mono text-[10px]">{pr.base.ref}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                        {timeAgo(pr.created_at)}
                      </span>
                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="View on GitHub"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                      <button
                        onClick={() => handleMerge(pr.number)}
                        disabled={actionLoading === `merge-${pr.number}` || pr.draft}
                        className={cn(
                          "h-7 px-3 rounded-md text-[12px] font-medium transition-all duration-150",
                          pr.draft
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                        )}
                      >
                        {actionLoading === `merge-${pr.number}` ? "Merging..." : "Merge"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Issues */}
        {!loading && tab === "issues" && (
          <>
            {issues.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card py-14 text-center">
                <p className="text-sm text-muted-foreground">No open issues</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-surface">
                {issues.map((issue, i) => (
                  <a
                    key={issue.number}
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "group flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors duration-100",
                      i < issues.length - 1 && "border-b border-border"
                    )}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-emerald-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground truncate">{issue.title}</span>
                        {issue.labels.map((l) => (
                          <span
                            key={l.name}
                            className="text-[10px] px-1.5 py-0.5 rounded-md border shrink-0"
                            style={{
                              borderColor: `#${l.color}40`,
                              color: `#${l.color}`,
                              backgroundColor: `#${l.color}10`,
                            }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground/60">
                        <span>#{issue.number}</span>
                        <span className="text-muted-foreground/20">&middot;</span>
                        <span>{issue.user.login}</span>
                      </div>
                    </div>

                    <span className="text-[11px] text-muted-foreground/40 tabular-nums shrink-0">
                      {timeAgo(issue.created_at)}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="text-muted-foreground/0 group-hover:text-muted-foreground/30 transition-all duration-150 shrink-0"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
