"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  greeting: string;
  firstName: string;
  hasGithub: boolean;
  hasGoogle: boolean;
  hasDatabase: boolean;
}

interface Activity {
  id: string;
  action: string;
  section: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface Stats {
  tickets: number;
  reports: number;
  chats: number;
}

export function DashboardContent({ greeting, firstName, hasGithub, hasGoogle, hasDatabase }: Props) {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats>({ tickets: 0, reports: 0, chats: 0 });
  const [loading, setLoading] = useState(true);

  const setupComplete = hasGithub && hasGoogle && hasDatabase;
  const setupProgress = [hasGithub, hasGoogle, hasDatabase].filter(Boolean).length;

  useEffect(() => {
    Promise.all([
      fetch("/api/activity").then((r) => r.json()),
      fetch("/api/tickets?status=open").then((r) => r.json()).catch(() => []),
      fetch("/api/reports/sessions").then((r) => r.json()).catch(() => []),
      fetch("/api/chat/sessions").then((r) => r.json()).catch(() => []),
    ]).then(([acts, tickets, reports, chats]) => {
      setActivities(Array.isArray(acts) ? acts : []);
      setStats({
        tickets: Array.isArray(tickets) ? tickets.length : 0,
        reports: Array.isArray(reports) ? reports.length : 0,
        chats: Array.isArray(chats) ? chats.length : 0,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-8 py-10">

        {/* Hero greeting */}
        <div className="mb-10">
          <p className="text-muted-foreground text-sm mb-1">{greeting}</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground leading-tight">
            {firstName}
          </h1>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-3">

          {/* Setup card — spans full width when incomplete */}
          {!setupComplete && (
            <div className="col-span-12 rounded-2xl bg-card border border-border p-6 shadow-surface">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[15px] font-medium text-foreground">Get started</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Connect your tools to unlock the full platform</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">{setupProgress}/3</span>
                  <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${(setupProgress / 3) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <SetupCard
                  done={hasGithub}
                  title="GitHub"
                  description="Repos, PRs, and issues"
                  href="/settings"
                  icon={<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/>}
                />
                <SetupCard
                  done={hasGoogle}
                  title="Google"
                  description="Email, calendar, and sheets"
                  href="/settings"
                  icon={<><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>}
                />
                <SetupCard
                  done={hasDatabase}
                  title="Database"
                  description="Run queries and reports"
                  href="/settings"
                  icon={<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></>}
                />
              </div>
            </div>
          )}

          {/* Stat tiles */}
          <div className="col-span-12 md:col-span-4">
            <StatTile
              label="Open Tickets"
              value={loading ? null : stats.tickets}
              onClick={() => router.push("/tickets")}
              accent="text-amber-600 dark:text-amber-400"
              bgAccent="bg-amber-500/8 dark:bg-amber-500/10"
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <StatTile
              label="Reports"
              value={loading ? null : stats.reports}
              onClick={() => router.push("/reports")}
              accent="text-primary"
              bgAccent="bg-primary/8 dark:bg-primary/10"
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <StatTile
              label="Chats"
              value={loading ? null : stats.chats}
              onClick={() => router.push("/chat")}
              accent="text-emerald-600 dark:text-emerald-400"
              bgAccent="bg-emerald-500/8 dark:bg-emerald-500/10"
            />
          </div>

          {/* Quick actions */}
          <div className="col-span-12 md:col-span-5 rounded-2xl bg-card border border-border p-5 shadow-surface">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">
              Quick Actions
            </h3>
            <div className="space-y-1">
              <ActionRow icon="chat" label="Start a new chat" onClick={() => router.push("/chat")} />
              <ActionRow icon="reports" label="Generate a report" onClick={() => router.push("/reports")} />
              <ActionRow icon="tickets" label="Create a ticket" onClick={() => router.push("/tickets")} />
              <ActionRow icon="repos" label="Browse repositories" onClick={() => router.push("/repos")} />
            </div>
          </div>

          {/* Activity feed */}
          <div className="col-span-12 md:col-span-7 rounded-2xl bg-card border border-border p-5 shadow-surface">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">
              Recent Activity
            </h3>

            {loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg skeleton shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 skeleton" style={{ width: `${60 + i * 5}%` }} />
                      <div className="h-2.5 skeleton" style={{ width: `${30 + i * 3}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && activities.length === 0 && (
              <div className="py-10 text-center">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50">
                    <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Your recent actions will appear here</p>
              </div>
            )}

            {!loading && activities.length > 0 && (
              <div className="space-y-0.5">
                {activities.slice(0, 7).map((a, i) => (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg transition-colors duration-150 hover:bg-muted/40",
                      i === 0 && "bg-muted/20"
                    )}
                  >
                    <ActivityIcon section={a.section} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground truncate">{a.title}</p>
                      {a.description && (
                        <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{a.description}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function SetupCard({ done, title, description, href, icon }: {
  done: boolean; title: string; description: string; href: string; icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150 border",
        done
          ? "border-transparent bg-muted/30 opacity-60"
          : "border-border hover:border-primary/20 hover:bg-muted/30"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
        done ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
      )}>
        {done ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13px] font-medium",
          done ? "line-through text-muted-foreground" : "text-foreground"
        )}>{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      {!done && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0"
        >
          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
        </svg>
      )}
    </a>
  );
}

function StatTile({ label, value, onClick, accent, bgAccent }: {
  label: string; value: number | null; onClick: () => void; accent: string; bgAccent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-card border border-border p-5 shadow-surface text-left transition-all duration-150 hover:shadow-surface-md hover:border-primary/15 group cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", bgAccent)}>
          <div className={cn("w-2 h-2 rounded-full", accent.replace("text-", "bg-"))} />
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all duration-150 -translate-x-1 group-hover:translate-x-0"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
      {value === null ? (
        <div className="h-9 w-14 skeleton mb-1" />
      ) : (
        <p className="text-[32px] font-semibold tracking-[-0.04em] text-foreground leading-none tabular-nums">
          {value}
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </button>
  );
}

function ActionRow({ icon, label, onClick }: {
  icon: string; label: string; onClick: () => void;
}) {
  const iconPaths: Record<string, React.ReactNode> = {
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    reports: <><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></>,
    tickets: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></>,
    repos: <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/></>,
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-all duration-150 group text-left cursor-pointer"
    >
      <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors duration-150">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className="text-muted-foreground group-hover:text-primary transition-colors duration-150"
        >
          {iconPaths[icon]}
        </svg>
      </div>
      <span className="text-[13px] text-foreground flex-1">{label}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all duration-150 shrink-0"
      >
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

function ActivityIcon({ section }: { section: string }) {
  const map: Record<string, React.ReactNode> = {
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    repos: <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/></>,
    tickets: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></>,
    reports: <><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></>,
    emails: <><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>,
  };
  return (
    <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60">
        {map[section] || <circle cx="12" cy="12" r="4"/>}
      </svg>
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
