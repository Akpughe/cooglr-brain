"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  completed_at: string | null;
  stats: Record<string, number>;
}

export function AnalyticsView({ workspaceId }: { workspaceId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/emails/campaigns?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns((Array.isArray(data) ? data : []).filter((c: CampaignRow) => c.status === "sent"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Aggregate stats across all sent campaigns
  const totals = campaigns.reduce(
    (acc, c) => {
      const s = (c.stats || {}) as Record<string, number>;
      acc.sent += s.sent || 0;
      acc.delivered += s.delivered || 0;
      acc.opened += s.opened || 0;
      acc.clicked += s.clicked || 0;
      acc.bounced += s.bounced || 0;
      acc.complained += s.complained || 0;
      acc.unsubscribed += s.unsubscribed || 0;
      return acc;
    },
    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 }
  );

  const avgOpenRate = totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(1) : "0";
  const avgClickRate = totals.sent > 0 ? ((totals.clicked / totals.sent) * 100).toFixed(1) : "0";
  const bounceRate = totals.sent > 0 ? ((totals.bounced / totals.sent) * 100).toFixed(2) : "0";

  if (loading) {
    return <div className="py-20 text-center text-[13px] text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top-level stats */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Total Sent"
          value={totals.sent.toLocaleString()}
          change={`${campaigns.length} campaigns`}
          color="text-foreground"
        />
        <MetricCard
          label="Avg Open Rate"
          value={`${avgOpenRate}%`}
          change={`${totals.opened.toLocaleString()} total opens`}
          color="text-emerald-600 dark:text-emerald-400"
          positive={parseFloat(avgOpenRate) > 20}
        />
        <MetricCard
          label="Avg Click Rate"
          value={`${avgClickRate}%`}
          change={`${totals.clicked.toLocaleString()} total clicks`}
          color="text-blue-600 dark:text-blue-400"
          positive={parseFloat(avgClickRate) > 5}
        />
        <MetricCard
          label="Bounce Rate"
          value={`${bounceRate}%`}
          change={parseFloat(bounceRate) < 2 ? "Healthy" : "Above 2% threshold"}
          color="text-foreground"
        />
      </div>

      {/* Campaign performance table */}
      <div className="rounded-2xl border border-border bg-card shadow-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-[12px] font-medium text-foreground/80">Campaign Performance</p>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-3 px-5 py-2 border-b border-border text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
          <span>Campaign</span>
          <span className="text-right">Sent</span>
          <span className="text-right">Delivered</span>
          <span className="text-right">Opened</span>
          <span className="text-right">Clicked</span>
          <span className="text-right">Bounced</span>
        </div>

        {campaigns.length === 0 && (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">No sent campaigns yet</div>
        )}
        {campaigns.map((c, i) => {
          const s = (c.stats || {}) as Record<string, number>;
          const sent = s.sent || 0;
          const delivered = s.delivered || 0;
          const opened = s.opened || 0;
          const clicked = s.clicked || 0;
          const bounced = s.bounced || 0;
          const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
          const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
          const date = c.completed_at ? new Date(c.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

          return (
            <div
              key={c.id}
              className={cn(
                "grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-3 items-center px-5 py-3 hover:bg-muted/20 transition-colors",
                i < campaigns.length - 1 && "border-b border-border"
              )}
            >
              <div>
                <p className="text-[13px] font-medium text-foreground">{c.name}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{date}</p>
              </div>
              <p className="text-[13px] text-foreground/80 text-right tabular-nums">{sent.toLocaleString()}</p>
              <p className="text-[13px] text-foreground/80 text-right tabular-nums">{delivered.toLocaleString()}</p>
              <div className="text-right">
                <p className="text-[13px] text-emerald-600 dark:text-emerald-400 tabular-nums">{opened.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground/50 tabular-nums">{openRate}%</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-blue-600 dark:text-blue-400 tabular-nums">{clicked.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground/50 tabular-nums">{clickRate}%</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-foreground/60 tabular-nums">{bounced}</p>
                <p className="text-[10px] text-muted-foreground/50 tabular-nums">{sent > 0 ? ((bounced / sent) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Delivery funnel */}
        <div className="rounded-2xl border border-border bg-card shadow-surface p-5">
          <p className="text-[12px] font-medium text-foreground/80 mb-4">Delivery Funnel (All Campaigns)</p>
          <div className="space-y-3">
            {[
              { label: "Sent", value: totals.sent, pct: 100, color: "bg-foreground/15" },
              { label: "Delivered", value: totals.delivered, pct: totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0, color: "bg-blue-500/30" },
              { label: "Opened", value: totals.opened, pct: totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0, color: "bg-emerald-500/40" },
              { label: "Clicked", value: totals.clicked, pct: totals.sent > 0 ? (totals.clicked / totals.sent) * 100 : 0, color: "bg-primary/40" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground w-16 shrink-0">{item.label}</span>
                <div className="flex-1 h-6 rounded-md bg-muted/30 overflow-hidden">
                  <div
                    className={cn("h-full rounded-md transition-all duration-500", item.color)}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <div className="w-20 text-right shrink-0">
                  <span className="text-[12px] text-foreground tabular-nums">{item.value.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-1 tabular-nums">{item.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health indicators */}
        <div className="rounded-2xl border border-border bg-card shadow-surface p-5">
          <p className="text-[12px] font-medium text-foreground/80 mb-4">Email Health</p>
          {(() => {
            const deliverability = totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 100;
            const bounce = totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0;
            const complaint = totals.sent > 0 ? (totals.complained / totals.sent) * 100 : 0;
            const unsub = totals.sent > 0 ? (totals.unsubscribed / totals.sent) * 100 : 0;
            return (
              <div className="space-y-4">
                <HealthItem label="Deliverability" value={parseFloat(deliverability.toFixed(1))} threshold={95}
                  status={deliverability >= 95 ? "good" : deliverability >= 90 ? "warning" : "bad"}
                  description={deliverability >= 95 ? "Above 95% threshold" : "Below 95% threshold"} />
                <HealthItem label="Bounce Rate" value={parseFloat(bounce.toFixed(2))} threshold={5}
                  status={bounce < 2 ? "good" : bounce < 5 ? "warning" : "bad"}
                  description={bounce < 5 ? "Below 5% threshold" : "Above 5% threshold"} invert />
                <HealthItem label="Spam Complaints" value={parseFloat(complaint.toFixed(3))} threshold={0.1}
                  status={complaint < 0.1 ? "good" : "bad"}
                  description={complaint < 0.1 ? "Below 0.1% threshold" : "Above 0.1% threshold"} invert />
                <HealthItem label="Unsubscribe Rate" value={parseFloat(unsub.toFixed(2))} threshold={1}
                  status={unsub < 1 ? "good" : "warning"}
                  description={unsub < 1 ? "Below 1% threshold" : "Above 1% threshold"} invert />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, change, color, positive }: {
  label: string; value: string; change: string; color: string; positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-surface">
      <p className="text-[11px] text-muted-foreground/60 mb-2">{label}</p>
      <p className={cn("text-[24px] font-semibold tracking-[-0.03em] tabular-nums leading-none", color)}>
        {value}
      </p>
      <p className={cn("text-[11px] mt-2 flex items-center gap-1", positive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50")}>
        {positive && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 15-6-6-6 6"/>
          </svg>
        )}
        {change}
      </p>
    </div>
  );
}

function HealthItem({ label, value, threshold, status, description, invert }: {
  label: string; value: number; threshold: number; status: "good" | "warning" | "bad"; description: string; invert?: boolean;
}) {
  const pct = invert
    ? Math.min(100, (1 - value / threshold) * 100)
    : Math.min(100, (value / threshold) * 100);

  const colors = {
    good: "bg-emerald-500",
    warning: "bg-amber-500",
    bad: "bg-red-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-foreground/80">{label}</span>
        <span className="text-[12px] font-medium text-foreground tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors[status])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/50 mt-1">{description}</p>
    </div>
  );
}
