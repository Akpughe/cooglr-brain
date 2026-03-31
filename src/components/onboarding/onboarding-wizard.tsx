"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/workspace/helpers";

interface OnboardingWizardProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string;
  };
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

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-foreground rounded-2xl text-background text-xl font-extrabold">
            5C
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to 500Claw</h1>
            <p className="text-muted-foreground mt-2">
              Your all-in-one workspace for teams.
              <br />
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-muted" />
            <div className="w-4 h-1 rounded-full bg-muted" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Name your workspace</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Choose something your team will recognize like the name of your organization or team.
            </p>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Core Inc."
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value.slice(0, 50))}
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
      </div>
    );
  }

  // Step 2: Profile
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-muted" />
          </div>
          <div>
            <h1 className="text-xl font-bold">What&apos;s your name?</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">
              {displayName ? displayName[0].toUpperCase() : user.email[0].toUpperCase()}
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
      </div>
    );
  }

  // Step 3: Invite team
  if (step === 3 && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Invite your team</h1>
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
                className="h-11 px-4 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Add
              </button>
            </div>
            {inviteEmails.length > 0 && (
              <div className="space-y-1">
                {inviteEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
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
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 animate-in fade-in duration-300">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-muted rounded-full animate-pulse">
          <div className="w-6 h-6 bg-muted-foreground/30 rounded-full" />
        </div>
        <p className="text-lg font-medium">
          {inviteEmails.length > 0 ? "Sending invitations..." : "Setting up your workspace..."}
        </p>
      </div>
    </div>
  );
}
