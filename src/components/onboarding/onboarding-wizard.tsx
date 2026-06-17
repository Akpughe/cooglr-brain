"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/workspace/helpers";
import { AuthShowcase } from "@/components/auth/auth-showcase";
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

// ── shared inline style helpers ──────────────────────────────────────────────

const primaryBtn: CSSProperties = {
  height: 44,
  padding: "0 22px",
  borderRadius: 999,
  background: "var(--ink)",
  color: "#fff",
  fontWeight: 500,
  fontSize: 14,
  border: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s, opacity 0.15s",
};

function primaryBtnProps(disabled?: boolean) {
  return {
    style: {
      ...primaryBtn,
      ...(disabled ? { opacity: 0.4, pointerEvents: "none" as const } : {}),
    },
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) e.currentTarget.style.background = "#000";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = "var(--ink)";
    },
  };
}

const textBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: 14,
  color: "var(--ink-2)",
  transition: "color 0.15s",
};

function textBtnProps() {
  return {
    style: textBtn,
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = "var(--ink)";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = "var(--ink-2)";
    },
  };
}

const headingStyle: CSSProperties = {
  fontSize: 22,
  color: "var(--ink)",
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const bodyStyle: CSSProperties = {
  fontSize: 14,
  color: "var(--ink-3)",
  marginTop: 6,
  lineHeight: 1.5,
};

function LogoTile({ size = 44 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: "var(--ink)",
        color: "#fff",
        fontWeight: 800,
        fontSize: size >= 60 ? 24 : 17,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      5C
    </div>
  );
}

function ProgressBar({ current }: { current: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS - 1}
      aria-label="Onboarding progress"
      style={{ display: "flex", alignItems: "center", gap: 12 }}
    >
      <div aria-hidden="true" style={{ display: "flex", gap: 4, flex: 1 }}>
        {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 999,
              background: i < current ? "var(--ink)" : "var(--line)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 12,
          color: "var(--ink-3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {current} of {TOTAL_STEPS - 1}
      </span>
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  // Loading state — centered full-screen
  if (loading) {
    return (
      <div
        className="agent-shell-root"
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="rise"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            aria-hidden="true"
            style={{ animation: "rcBreathe 2.2s ease-in-out infinite" }}
          >
            <LogoTile size={64} />
          </div>
          <p
            role="status"
            aria-live="polite"
            style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}
          >
            Setting up your workspace...
          </p>
        </div>
      </div>
    );
  }

  // Step 0: Welcome — centered full-screen
  if (step === 0) {
    return (
      <div
        className="agent-shell-root"
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <main
          role="main"
          className="rise"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 28,
            padding: "0 24px",
          }}
        >
          <LogoTile size={64} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ ...headingStyle, fontSize: 30 }}>
              Welcome to 500Claw
            </h1>
            <p style={{ ...bodyStyle, marginTop: 0, maxWidth: 360 }}>
              Let&apos;s get you set up in a few quick steps.
            </p>
          </div>

          <button onClick={() => setStep(1)} {...primaryBtnProps()}>
            Get Started
          </button>
        </main>
      </div>
    );
  }

  // Step 1: Name workspace — split layout
  if (step === 1) {
    return (
      <div
        className="agent-shell-root"
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg)",
        }}
      >
        {/* Left — form */}
        <div
          style={{
            flex: "1 1 0",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 48px",
          }}
        >
          <main
            role="main"
            className="rise"
            style={{
              width: "100%",
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <button onClick={() => setStep(0)} {...textBtnProps()}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </button>

            <ProgressBar current={1} />

            <div>
              <h1 style={headingStyle}>Name your workspace</h1>
              <p style={bodyStyle}>
                Choose something your team will recognize like the name of your
                organization or team.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  id="workspace-name"
                  aria-label="Workspace name"
                  aria-describedby="workspace-url-hint"
                  placeholder="e.g. Core Inc."
                  value={workspaceName}
                  onChange={(e) =>
                    setWorkspaceName(e.target.value.slice(0, 50))
                  }
                  style={{
                    width: "100%",
                    height: 44,
                    paddingRight: 48,
                    borderRadius: 12,
                  }}
                  autoFocus
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 12,
                    color: "var(--ink-3)",
                  }}
                >
                  {workspaceName.length}/50
                </span>
              </div>
              {workspaceName && (
                <p
                  id="workspace-url-hint"
                  style={{ fontSize: 12.5, color: "var(--ink-3)" }}
                >
                  Workspace URL: .../{slugify(workspaceName)}
                </p>
              )}
            </div>

            <div>
              <button
                onClick={() => setStep(2)}
                {...primaryBtnProps(!workspaceName.trim())}
              >
                Next
              </button>
            </div>
          </main>
        </div>

        {/* Right — showcase (hidden on small screens) */}
        <div
          className="auth-showcase-wrap"
          style={{ flex: "1 1 0", minWidth: 0 }}
        >
          <AuthShowcase workspaceName={workspaceName} userName={displayName} />
        </div>
      </div>
    );
  }

  // Step 2: Profile — split layout
  if (step === 2) {
    return (
      <div
        className="agent-shell-root"
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg)",
        }}
      >
        {/* Left — form */}
        <div
          style={{
            flex: "1 1 0",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 48px",
          }}
        >
          <main
            role="main"
            className="rise"
            style={{
              width: "100%",
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <button onClick={() => setStep(1)} {...textBtnProps()}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </button>

            <ProgressBar current={2} />

            <div>
              <h1 style={headingStyle}>What&apos;s your name?</h1>
              <p style={bodyStyle}>
                This is how your teammates will see you.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "var(--ink)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {displayName
                  ? displayName[0].toUpperCase()
                  : user.email[0].toUpperCase()}
              </div>
              <input
                type="text"
                id="display-name"
                aria-label="Display name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                style={{ flex: 1, height: 44, borderRadius: 12 }}
                autoFocus
              />
            </div>

            <div>
              <button
                onClick={() => setStep(3)}
                {...primaryBtnProps(!displayName.trim())}
              >
                Next
              </button>
            </div>
          </main>
        </div>

        {/* Right — showcase (hidden on small screens) */}
        <div
          className="auth-showcase-wrap"
          style={{ flex: "1 1 0", minWidth: 0 }}
        >
          <AuthShowcase workspaceName={workspaceName} userName={displayName} />
        </div>
      </div>
    );
  }

  // Step 3: Invite team — centered full-screen, no split
  if (step === 3) {
    return (
      <div
        className="agent-shell-root"
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <main
          role="main"
          className="rise"
          style={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <button onClick={() => setStep(2)} {...textBtnProps()}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>

          <ProgressBar current={3} />

          <div>
            <h1 style={headingStyle}>Invite your team</h1>
            <p style={bodyStyle}>
              Add teammates by email. You can always invite more later.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                id="invite-email"
                aria-label="Teammate email"
                placeholder="teammate@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                style={{
                  flex: 1,
                  height: 44,
                  padding: "0 14px",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "var(--bg)",
                  color: "var(--ink)",
                  outline: "none",
                  fontSize: 14,
                }}
                autoFocus
              />
              <button
                onClick={addEmail}
                style={{
                  height: 44,
                  padding: "0 16px",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--hover-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg)";
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Add
              </button>
            </div>

            {inviteEmails.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {inviteEmails.map((email) => (
                  <div
                    key={email}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 6px 6px 12px",
                      borderRadius: 999,
                      background: "var(--hover-soft)",
                      fontSize: 13,
                      color: "var(--ink)",
                    }}
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      aria-label={`Remove ${email}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--ink-3)",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--ink)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--ink-3)";
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" style={{ color: "var(--red)", fontSize: 13 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={handleFinish} {...primaryBtnProps()}>
              {inviteEmails.length > 0 ? "Send Invites & Continue" : "Continue"}
            </button>
            {inviteEmails.length === 0 && (
              <button onClick={handleFinish} {...textBtnProps()}>
                Skip for now
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return null;
}
