"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

const SECTION_EMOJI: Record<string, string> = {
  repos: "\uD83D\uDCC1",
  tickets: "\uD83D\uDCCB",
  reports: "\uD83D\uDCCA",
  emails: "\u2709\uFE0F",
  chat: "\uD83D\uDCAC",
};

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
      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {firstName}</h1>
          <p className="text-muted-foreground text-sm mt-1">Here&apos;s an overview of your workspace</p>
        </div>

        {/* Setup Checklist */}
        {!setupComplete && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent shadow-warm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm">Complete your setup</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{setupProgress} of 3 integrations connected</p>
                </div>
                <div className="flex items-center gap-1">
                  {[hasGithub, hasGoogle, hasDatabase].map((done, i) => (
                    <div key={i} className={`w-8 h-1.5 rounded-full transition-colors ${done ? "bg-primary" : "bg-border"}`} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <SetupItem
                  done={hasGithub}
                  emoji={"\uD83D\uDC19"}
                  label="Connect GitHub"
                  description="View repos, manage PRs, create issues"
                  href="/settings"
                />
                <SetupItem
                  done={hasGoogle}
                  emoji={"G"}
                  label="Connect Google"
                  description="Send emails, manage calendar, export to Sheets"
                  href="/settings"
                  isText
                />
                <SetupItem
                  done={hasDatabase}
                  emoji={"\uD83D\uDDC4\uFE0F"}
                  label="Connect a database"
                  description="Generate AI-powered reports from your data"
                  href="/settings"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Open Tickets" value={loading ? "\u2014" : String(stats.tickets)} onClick={() => router.push("/tickets")} />
          <StatCard label="Reports" value={loading ? "\u2014" : String(stats.reports)} onClick={() => router.push("/reports")} />
          <StatCard label="Chat Sessions" value={loading ? "\u2014" : String(stats.chats)} onClick={() => router.push("/chat")} />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction label="New Chat" emoji={"\uD83D\uDCAC"} onClick={() => router.push("/chat")} />
            <QuickAction label="New Report" emoji={"\uD83D\uDCCA"} onClick={() => router.push("/reports")} />
            <QuickAction label="Create Ticket" emoji={"\uD83D\uDCCB"} onClick={() => router.push("/tickets")} />
            <QuickAction label="View Repos" emoji={"\uD83D\uDCC1"} onClick={() => router.push("/repos")} />
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Activity</h3>
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          )}
          {!loading && activities.length === 0 && (
            <Card className="shadow-warm">
              <CardContent className="p-8 text-center">
                <p className="text-lg mb-1">{"\uD83D\uDC4B"}</p>
                <p className="text-sm font-medium">No recent activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start by exploring the platform — try the chat or create a report!</p>
              </CardContent>
            </Card>
          )}
          {!loading && activities.length > 0 && (
            <div className="space-y-1">
              {activities.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                    {SECTION_EMOJI[a.section] || "\u2022"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SetupItem({ done, emoji, label, description, href, isText }: {
  done: boolean; emoji: string; label: string; description: string; href: string; isText?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
        done ? "bg-muted/30 opacity-60" : "bg-card hover:bg-muted/50 border border-border hover:border-primary/20"
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        done ? "bg-green-500/10 text-green-600" : "bg-muted"
      }`}>
        {done ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          isText
            ? <span className="text-sm font-bold text-muted-foreground">{emoji}</span>
            : <span className="text-base">{emoji}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {!done && (
        <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary">Connect</Badge>
      )}
    </a>
  );
}

function StatCard({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:shadow-warm-md transition-all hover:-translate-y-0.5 shadow-warm" onClick={onClick}>
      <CardContent className="p-5">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function QuickAction({ label, emoji, onClick }: { label: string; emoji: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      className="h-auto py-4 px-4 flex flex-col items-center gap-2 rounded-xl border-border hover:bg-muted/50 hover:border-primary/20 hover:-translate-y-0.5 transition-all"
      onClick={onClick}
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
