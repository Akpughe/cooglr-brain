"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/workspace/helpers";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, X } from "lucide-react";

interface OnboardingWizardProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string;
  };
}

const TOTAL_STEPS = 4;

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1 flex-1">
        {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i < current ? "bg-foreground" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {current} of {TOTAL_STEPS - 1}
      </span>
    </div>
  );
}

function WorkspacePreview({
  workspaceName,
  displayName,
}: {
  workspaceName: string;
  displayName: string;
}) {
  const initial = workspaceName.trim()
    ? workspaceName.trim()[0].toUpperCase()
    : "W";
  const name = workspaceName.trim() || "Workspace";
  const userName = displayName.trim() || "You";

  return (
    <div className="flex-1 hidden lg:flex items-center justify-center">
      <div className="w-64 rounded-xl border border-border bg-muted/30 shadow-sm overflow-hidden text-sm select-none">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
            {initial}
          </div>
          <span className="font-semibold text-foreground truncate">
            {name}
          </span>
        </div>

        {/* Channels */}
        <div className="px-4 py-2.5 space-y-1 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Channels
          </p>
          <p className="text-muted-foreground"># general</p>
          <p className="text-muted-foreground"># random</p>
        </div>

        {/* User */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground">
            {userName[0].toUpperCase()}
          </div>
          <span className="text-foreground truncate">{userName}</span>
        </div>
      </div>
    </div>
  );
}

export function OnboardingWizard({ user }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workspaceName, setWorkspaceName] = useState("");
  const [displayName, setDisplayName] = useState(user.fullName);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addEmail() {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes("@") && !inviteEmails.includes(email)) {
      setInviteEmails([...inviteEmails, email]);
      setEmailInput("");
    }
  }

  function removeEmail(email: string) {
    setInviteEmails(inviteEmails.filter((e) => e !== email));
  }

  async function handleFinish() {
    setLoading(true);
    setError("");

    try {
      if (displayName !== user.fullName) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: displayName }),
        });
      }

      const wsRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });

      if (!wsRes.ok) {
        const data = await wsRes.json();
        throw new Error(data.error || "Failed to create workspace");
      }

      const { workspace } = await wsRes.json();

      if (inviteEmails.length > 0) {
        await fetch(`/api/workspaces/${workspace.id}/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: inviteEmails }),
        });
      }

      router.push(`/${workspace.slug}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 animate-in fade-in duration-300">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-foreground rounded-2xl text-background text-xl font-extrabold animate-pulse">
            5C
          </div>
          <p className="text-lg font-medium text-foreground">
            Setting up your workspace...
          </p>
        </div>
      </div>
    );
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Logo with radial glow */}
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute w-40 h-40 rounded-full bg-gradient-radial from-foreground/10 to-transparent blur-2xl" />
            <div className="relative inline-flex items-center justify-center w-20 h-20 bg-foreground rounded-2xl text-background text-2xl font-extrabold">
              5C
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome to 500Claw
            </h1>
            <p className="text-muted-foreground text-base max-w-sm mx-auto">
              Let&apos;s get you set up in a few quick steps.
            </p>
          </div>

          <button
            onClick={() => setStep(1)}
            className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Name workspace
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="flex w-full max-w-4xl gap-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Left: form */}
          <div className="flex-1 max-w-md space-y-6">
            <button
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <ProgressBar current={1} />

            <div>
              <h1 className="text-xl font-bold text-foreground">
                Name your workspace
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Choose something your team will recognize like the name of your
                organization or team.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Core Inc."
                  value={workspaceName}
                  onChange={(e) =>
                    setWorkspaceName(e.target.value.slice(0, 50))
                  }
                  className="w-full h-11 px-4 pr-12 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {workspaceName.length}/50
                </span>
              </div>
              {workspaceName && (
                <p className="text-xs text-muted-foreground">
                  Workspace URL: .../{slugify(workspaceName)}
                </p>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!workspaceName.trim()}
              className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Next
            </button>
          </div>

          {/* Right: live preview */}
          <WorkspacePreview
            workspaceName={workspaceName}
            displayName={displayName}
          />
        </div>
      </div>
    );
  }

  // Step 2: Profile
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="flex w-full max-w-4xl gap-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Left: form */}
          <div className="flex-1 max-w-md space-y-6">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <ProgressBar current={2} />

            <div>
              <h1 className="text-xl font-bold text-foreground">
                What&apos;s your name?
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                This is how your teammates will see you.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">
                {displayName
                  ? displayName[0].toUpperCase()
                  : user.email[0].toUpperCase()}
              </div>
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                className="flex-1 h-11 px-4 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!displayName.trim()}
              className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Next
            </button>
          </div>

          {/* Right: live preview */}
          <WorkspacePreview
            workspaceName={workspaceName}
            displayName={displayName}
          />
        </div>
      </div>
    );
  }

  // Step 3: Invite team (full-width centered, no preview)
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <ProgressBar current={3} />

          <div>
            <h1 className="text-xl font-bold text-foreground">
              Invite your team
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Add teammates by email. You can always invite more later.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="teammate@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                className="flex-1 h-11 px-4 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={addEmail}
                className="h-11 px-4 border border-border rounded-lg text-sm hover:bg-muted transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {inviteEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {inviteEmails.map((email) => (
                  <div
                    key={email}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleFinish}
              className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {inviteEmails.length > 0 ? "Send Invites & Continue" : "Continue"}
            </button>
            {inviteEmails.length === 0 && (
              <button
                onClick={handleFinish}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
