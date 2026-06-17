"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { BarChart3, ArrowRight, ArrowLeft, Check, Database, Sparkles, FileSpreadsheet, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = [
  { id: "intro", label: "Welcome", icon: BarChart3 },
  { id: "database", label: "Connect Database", icon: Database },
  { id: "ready", label: "Ready", icon: Sparkles },
];

interface Props {
  workspaceId: string;
  onComplete: () => void;
}

export function ReportsOnboarding({ workspaceId, onComplete }: Props) {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [step, setStep] = useState(0);
  const [dbConnected, setDbConnected] = useState(false);

  // Connection form state
  const [dbType, setDbType] = useState("postgresql");
  const [connName, setConnName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [saving, setSaving] = useState(false);

  const currentStep = STEPS[step];

  const placeholderConnString =
    dbType === "clickhouse"
      ? "clickhouse://user:password@host:8443/database"
      : "postgresql://user:password@host:5432/database";

  async function handleConnect() {
    if (!connName || !connectionString) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/db/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: connName,
          connectionString,
          dbType: dbType === "clickhouse" ? "clickhouse" : "postgres",
          workspaceId,
        }),
      });
      if (res.ok) {
        setDbConnected(true);
        toast.success("Database connected!");
        setStep(2);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to connect database");
      }
    } catch {
      toast.error("Failed to connect");
    }
    setSaving(false);
  }

  function renderStepContent() {
    switch (currentStep.id) {
      case "intro":
        return (
          <div className="text-center max-w-lg mx-auto space-y-6">
            <div className="size-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
              <BarChart3 className="size-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-muted-foreground leading-relaxed">
              Ask questions about your data in plain English. Get SQL queries, results, charts, and executive reports — all powered by AI.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8">
              {[
                { icon: Sparkles, title: "AI-Powered", desc: "Describe what you want in natural language — AI writes the SQL" },
                { icon: PieChart, title: "Visual Reports", desc: "Auto-generated charts, key metrics, and executive summaries" },
                { icon: FileSpreadsheet, title: "Export", desc: "Export results to Google Sheets or download as PDF" },
              ].map((feature) => (
                <div key={feature.title} className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06]">
                  <feature.icon className="size-5 text-indigo-400 mb-2" />
                  <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">Connect a database to get started.</p>
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors inline-flex items-center gap-2"
              >
                Get Started <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        );

      case "database":
        return (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Connect your database</h2>
              <p className="text-sm text-muted-foreground">Reports will read your data to generate insights. Connection is read-only.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Database Type</label>
                <select
                  value={dbType}
                  onChange={(e) => setDbType(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2.5 text-sm outline-none"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="clickhouse">ClickHouse</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Connection Name</label>
                <input
                  type="text"
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                  placeholder="e.g. Production DB"
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-foreground/20"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Connection String</label>
                <input
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder={placeholderConnString}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-foreground/20 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Include credentials and database name in the URL.
                </p>
              </div>

              <button
                onClick={handleConnect}
                disabled={saving || !connName || !connectionString}
                className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {saving ? "Connecting..." : "Connect Database"}
              </button>
            </div>
          </div>
        );

      case "ready":
        return (
          <div className="text-center max-w-md mx-auto space-y-6">
            <div className="size-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Check className="size-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold">You're all set!</h2>
            <p className="text-sm text-muted-foreground">Your database is connected. Start asking questions about your data in plain English.</p>

            <div className="space-y-2 text-left max-w-sm mx-auto">
              <div className="flex items-center gap-2 py-1.5 text-sm">
                <Check className="size-4 text-success" />
                <span className="text-white">Database connected</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] text-left max-w-sm mx-auto">
              <p className="text-xs text-muted-foreground mb-2">Try asking something like:</p>
              <p className="text-sm italic text-indigo-300">"Show me the top 10 customers by revenue this month"</p>
            </div>

            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors inline-flex items-center gap-2"
            >
              Start Querying <ArrowRight className="size-4" />
            </button>
          </div>
        );
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 py-4 border-b border-foreground/[0.06]">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && <div className={cn("w-8 h-px", isDone ? "bg-indigo-400/40" : "bg-foreground/10")} />}
              <button
                onClick={() => { if (isDone) setStep(i); }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors",
                  isActive ? "bg-indigo-500/20 text-indigo-300" :
                  isDone ? "text-success/70 cursor-pointer" : "text-foreground/20 cursor-default"
                )}
              >
                {isDone ? <Check className="size-3" /> : <Icon className="size-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        {renderStepContent()}
      </div>

      {/* Back button */}
      {step > 0 && step < STEPS.length - 1 && (
        <div className="flex justify-center pb-6">
          <button
            onClick={() => setStep(step - 1)}
            className="text-sm text-muted-foreground hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
        </div>
      )}
    </div>
  );
}
