"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { Mail, ArrowRight, ArrowLeft, Check, SkipForward, Send, Users, FileText, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = [
  { id: "intro", label: "Welcome", icon: Mail },
  { id: "provider", label: "Email Provider", icon: Settings },
  { id: "audience", label: "Audience", icon: Users, skippable: true },
  { id: "template", label: "Template", icon: FileText, skippable: true },
  { id: "ready", label: "Ready", icon: Send },
];

interface Props {
  workspaceId: string;
  onComplete: () => void;
}

export function EmailOnboarding({ workspaceId, onComplete }: Props) {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [step, setStep] = useState(0);
  const [providerDone, setProviderDone] = useState(false);
  const [audienceDone, setAudienceDone] = useState(false);
  const [templateDone, setTemplateDone] = useState(false);

  // Provider setup form state
  const [providerName, setProviderName] = useState("resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [saving, setSaving] = useState(false);

  const currentStep = STEPS[step];

  async function handleSaveProvider() {
    if (!apiKey || !fromEmail || !fromName) {
      toast.error("Please fill in all fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/emails/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: providerName,
          apiKey,
          fromEmail,
          fromName,
          workspaceId,
        }),
      });
      if (res.ok) {
        setProviderDone(true);
        toast.success("Email provider connected!");
        setStep(2); // Move to audience step
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save provider");
      }
    } catch {
      toast.error("Failed to connect provider");
    }
    setSaving(false);
  }

  function renderStepContent() {
    switch (currentStep.id) {
      case "intro":
        return (
          <div className="text-center max-w-lg mx-auto space-y-6">
            <div className="size-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
              <Mail className="size-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold">Email Marketing</h1>
            <p className="text-muted-foreground leading-relaxed">
              Create and send beautiful email campaigns to your audience. Track opens, clicks, and engagement — all from within your workspace.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8">
              {[
                { icon: Send, title: "Campaigns", desc: "Draft, schedule, and send emails to your audience" },
                { icon: FileText, title: "Templates", desc: "Design templates manually or generate with AI" },
                { icon: Users, title: "Audiences", desc: "Import contacts via CSV or database queries" },
              ].map((feature) => (
                <div key={feature.title} className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06]">
                  <feature.icon className="size-5 text-indigo-400 mb-2" />
                  <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">Let's set things up. It only takes a minute.</p>
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors inline-flex items-center gap-2"
              >
                Get Started <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        );

      case "provider":
        return (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Connect your email provider</h2>
              <p className="text-sm text-muted-foreground">You'll need an API key from your email service to send campaigns.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Provider</label>
                <select
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2.5 text-sm outline-none"
                >
                  <option value="resend">Resend</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="ses">Amazon SES</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={providerName === "resend" ? "re_..." : "Enter your API key"}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-foreground/20"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">From Email</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@yourdomain.com"
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-foreground/20"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">From Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your Company"
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-foreground/20"
                />
              </div>

              <button
                onClick={handleSaveProvider}
                disabled={saving || !apiKey || !fromEmail || !fromName}
                className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {saving ? "Connecting..." : "Connect Provider"}
              </button>
            </div>
          </div>
        );

      case "audience":
        return (
          <div className="max-w-md mx-auto space-y-6 text-center">
            <h2 className="text-xl font-semibold">Import your audience</h2>
            <p className="text-sm text-muted-foreground">Upload a CSV of contacts or connect a database. You can also do this later.</p>

            <div className="space-y-3 text-left">
              <button
                onClick={() => {
                  setAudienceDone(true);
                  router.push(`/${workspace.slug}/email-marketing/audiences`);
                }}
                className="w-full p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] hover:bg-foreground/[0.06] transition-colors text-left"
              >
                <Users className="size-5 text-indigo-400 mb-1" />
                <p className="font-medium text-sm">Import Contacts</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upload CSV or connect a database query</p>
              </button>
            </div>

            <button
              onClick={() => setStep(3)}
              className="text-sm text-muted-foreground hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <SkipForward className="size-3.5" /> Skip for now
            </button>
          </div>
        );

      case "template":
        return (
          <div className="max-w-md mx-auto space-y-6 text-center">
            <h2 className="text-xl font-semibold">Create a template</h2>
            <p className="text-sm text-muted-foreground">Design your first email template. You can create one manually or let AI generate it.</p>

            <div className="space-y-3 text-left">
              <button
                onClick={() => {
                  setTemplateDone(true);
                  router.push(`/${workspace.slug}/email-marketing/templates`);
                }}
                className="w-full p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] hover:bg-foreground/[0.06] transition-colors text-left"
              >
                <FileText className="size-5 text-indigo-400 mb-1" />
                <p className="font-medium text-sm">Create Template</p>
                <p className="text-xs text-muted-foreground mt-0.5">Design manually with HTML or use plain text</p>
              </button>
              <button
                onClick={() => {
                  setTemplateDone(true);
                  router.push(`/${workspace.slug}/email-marketing/templates`);
                }}
                className="w-full p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] hover:bg-foreground/[0.06] transition-colors text-left"
              >
                <Sparkles className="size-5 text-purple-400 mb-1" />
                <p className="font-medium text-sm">Generate with AI</p>
                <p className="text-xs text-muted-foreground mt-0.5">Describe what you want and AI creates the template</p>
              </button>
            </div>

            <button
              onClick={() => setStep(4)}
              className="text-sm text-muted-foreground hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <SkipForward className="size-3.5" /> Skip for now
            </button>
          </div>
        );

      case "ready":
        return (
          <div className="text-center max-w-md mx-auto space-y-6">
            <div className="size-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Check className="size-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold">You're all set!</h2>
            <p className="text-sm text-muted-foreground">Your email marketing workspace is ready. Start creating campaigns.</p>

            <div className="space-y-2 text-left max-w-sm mx-auto">
              {[
                { label: "Email provider", done: providerDone },
                { label: "Audience imported", done: audienceDone },
                { label: "Template created", done: templateDone },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 py-1.5 text-sm">
                  {item.done ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <div className="size-4 rounded-full border border-foreground/20" />
                  )}
                  <span className={item.done ? "text-white" : "text-muted-foreground"}>{item.label}</span>
                  {!item.done && <span className="text-xs text-muted-foreground/50 ml-auto">skipped</span>}
                </div>
              ))}
            </div>

            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors inline-flex items-center gap-2"
            >
              Go to Campaigns <ArrowRight className="size-4" />
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
