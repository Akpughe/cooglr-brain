"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CampaignsView } from "@/components/emails/campaigns-view";
import { TemplatesView } from "@/components/emails/templates-view";
import { AudiencesView } from "@/components/emails/audiences-view";
import { AnalyticsView } from "@/components/emails/analytics-view";

const TABS = [
  { id: "campaigns" as const, label: "Campaigns", icon: <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/> },
  { id: "templates" as const, label: "Templates", icon: <><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></> },
  { id: "audiences" as const, label: "Audiences", icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
  { id: "analytics" as const, label: "Analytics", icon: <><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></> },
];

type TabId = typeof TABS[number]["id"];

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("campaigns");

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1060px] mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
              Email Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Campaigns, templates, and audience management
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 border-b border-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-[13px] border-b-2 -mb-px transition-colors duration-100",
                activeTab === tab.id
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {tab.icon}
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "campaigns" && <CampaignsView />}
        {activeTab === "templates" && <TemplatesView />}
        {activeTab === "audiences" && <AudiencesView />}
        {activeTab === "analytics" && <AnalyticsView />}
      </div>
    </div>
  );
}
