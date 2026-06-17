"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace/context";

type Tab = "account" | "preferences" | "notifications";
type Theme = "System" | "Light" | "Dark";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AgentProfileView() {
  const { members, currentUserId } = useWorkspace();
  const me = members.find((m) => m.userId === currentUserId);

  const initial = (me?.fullName?.[0] ?? me?.email?.[0] ?? "?").toUpperCase();
  const role = me?.role ?? "member";

  const [tab, setTab] = useState<Tab>("account");

  // Account fields
  const [fullName, setFullName] = useState(me?.fullName ?? "");
  const email = me?.email ?? "";
  const [photoRemoveHover, setPhotoRemoveHover] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) {
        let message = "Failed to update profile";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse errors, keep default message
        }
        toast(message);
        return;
      }
      toast("Profile updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  // Preferences
  const [theme, setTheme] = useState<Theme>("System");

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [productNews, setProductNews] = useState(false);

  const [hoverTab, setHoverTab] = useState<Tab | null>(null);

  const labelStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ink)",
  };
  const fieldLabelStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--ink)",
  };
  const helperStyle: CSSProperties = {
    fontSize: 12.5,
    color: "var(--ink-3)",
    marginTop: 3,
  };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div className="pane" style={{ maxWidth: 760, margin: "0 auto", padding: "8px 40px 60px" }}>
        {/* Title */}
        <h1
          style={{
            fontSize: 27,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Profile
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-3)",
            marginTop: 4,
          }}
        >
          Manage your personal account and preferences
        </p>

        {/* Pill tabs */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            const hovered = hoverTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                onMouseEnter={() => setHoverTab(t.id)}
                onMouseLeave={() => setHoverTab(null)}
                style={{
                  height: 34,
                  padding: "0 16px",
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                  border: active ? "1px solid transparent" : "1px solid var(--line)",
                  background: active
                    ? "var(--hover-soft)"
                    : hovered
                      ? "var(--hover-soft)"
                      : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-2)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "account" && (
          <AccountTab
            initial={initial}
            role={role}
            fullName={fullName}
            setFullName={setFullName}
            email={email}
            photoRemoveHover={photoRemoveHover}
            setPhotoRemoveHover={setPhotoRemoveHover}
            saving={saving}
            onSave={handleSave}
            labelStyle={labelStyle}
            fieldLabelStyle={fieldLabelStyle}
            helperStyle={helperStyle}
          />
        )}

        {tab === "preferences" && (
          <PreferencesTab theme={theme} setTheme={setTheme} />
        )}

        {tab === "notifications" && (
          <NotificationsTab
            emailNotifs={emailNotifs}
            setEmailNotifs={setEmailNotifs}
            mentions={mentions}
            setMentions={setMentions}
            weeklyDigest={weeklyDigest}
            setWeeklyDigest={setWeeklyDigest}
            productNews={productNews}
            setProductNews={setProductNews}
          />
        )}
      </div>
    </div>
  );
}

/* ————— Account tab ————— */
function AccountTab(props: {
  initial: string;
  role: string;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  photoRemoveHover: boolean;
  setPhotoRemoveHover: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  labelStyle: CSSProperties;
  fieldLabelStyle: CSSProperties;
  helperStyle: CSSProperties;
}) {
  const {
    initial,
    role,
    fullName,
    setFullName,
    email,
    photoRemoveHover,
    setPhotoRemoveHover,
    saving,
    onSave,
    labelStyle,
    fieldLabelStyle,
    helperStyle,
  } = props;

  const [deleteHover, setDeleteHover] = useState(false);

  return (
    <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={labelStyle}>Your account</div>

      {/* Profile photo */}
      <div>
        <div style={fieldLabelStyle}>Profile photo</div>
        <div style={helperStyle}>PNG or JPG, at least 256 × 256px</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--green)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <button className="btn btn-outline">Upload</button>
          <button
            onMouseEnter={() => setPhotoRemoveHover(true)}
            onMouseLeave={() => setPhotoRemoveHover(false)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              padding: "7px 4px",
              color: photoRemoveHover ? "var(--red)" : "var(--ink-2)",
              transition: "color 0.12s ease",
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Full name */}
      <div>
        <div style={fieldLabelStyle}>Full name</div>
        <input
          type="text"
          aria-label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{ width: "100%", marginTop: 8 }}
        />
      </div>

      {/* Email */}
      <div>
        <div style={fieldLabelStyle}>Email</div>
        <div style={helperStyle}>Used for sign-in and notifications</div>
        <input
          type="text"
          aria-label="Email"
          value={email}
          readOnly
          disabled
          style={{
            width: "100%",
            marginTop: 8,
            color: "var(--ink-3)",
            cursor: "not-allowed",
          }}
        />
        <div style={helperStyle}>Managed by your sign-in provider</div>
      </div>

      {/* Role */}
      <div>
        <div style={fieldLabelStyle}>Role</div>
        <div style={{ marginTop: 8 }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 999,
              background: "var(--hover-soft)",
              color: "var(--ink-2)",
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            {capitalize(role)}
          </span>
        </div>
        <div style={helperStyle}>Your role is managed by a workspace owner</div>
      </div>

      {/* Save changes */}
      <div>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: "var(--hover-soft)",
            color: "var(--ink-3)",
            border: "none",
            height: 36,
            borderRadius: 10,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            transition: "background 0.12s ease",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--line)" }} />

      {/* Danger zone */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}>
          Danger zone
        </div>
        <div
          className="card"
          style={{
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "14px 16px",
          }}
        >
          <div>
            <div style={fieldLabelStyle}>Delete account</div>
            <div style={helperStyle}>Permanently remove your account and data</div>
          </div>
          <button
            className="btn btn-outline"
            onMouseEnter={() => setDeleteHover(true)}
            onMouseLeave={() => setDeleteHover(false)}
            style={{
              color: "var(--red)",
              border: "1px solid var(--line)",
              boxShadow: "none",
              background: deleteHover ? "#fdf1f0" : "var(--bg)",
            }}
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ————— Preferences tab ————— */
function PreferencesTab(props: {
  theme: Theme;
  setTheme: (v: Theme) => void;
}) {
  const { theme, setTheme } = props;
  const [langHover, setLangHover] = useState(false);

  return (
    <div className="card" style={{ marginTop: 28, border: "1px solid var(--line)", overflow: "hidden" }}>
      <PrefRow
        first
        label="Theme"
        helper="Choose how the app looks"
        control={<ThemeSegments theme={theme} setTheme={setTheme} />}
      />
      <PrefRow
        label="Language"
        helper="Interface language"
        control={
          <button
            aria-label="Language: English"
            aria-haspopup="listbox"
            aria-expanded={false}
            onMouseEnter={() => setLangHover(true)}
            onMouseLeave={() => setLangHover(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: "0 12px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: langHover ? "var(--hover-soft)" : "var(--bg)",
              color: "var(--ink)",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "background 0.12s ease",
            }}
          >
            English
            <ChevronDown size={15} aria-hidden style={{ color: "var(--ink-2)" }} />
          </button>
        }
      />
    </div>
  );
}

function ThemeSegments(props: { theme: Theme; setTheme: (v: Theme) => void }) {
  const { theme, setTheme } = props;
  const options: Theme[] = ["System", "Light", "Dark"];
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        gap: 2,
        borderRadius: 999,
        background: "var(--hover-soft)",
      }}
    >
      {options.map((opt) => {
        const active = theme === opt;
        return (
          <button
            key={opt}
            onClick={() => setTheme(opt)}
            style={{
              height: 26,
              padding: "0 12px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 500,
              fontFamily: "inherit",
              transition: "background 0.15s ease, color 0.15s ease",
              background: active ? "var(--ink)" : "transparent",
              color: active ? "#fff" : "var(--ink-2)",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ————— Notifications tab ————— */
function NotificationsTab(props: {
  emailNotifs: boolean;
  setEmailNotifs: (v: boolean) => void;
  mentions: boolean;
  setMentions: (v: boolean) => void;
  weeklyDigest: boolean;
  setWeeklyDigest: (v: boolean) => void;
  productNews: boolean;
  setProductNews: (v: boolean) => void;
}) {
  const {
    emailNotifs,
    setEmailNotifs,
    mentions,
    setMentions,
    weeklyDigest,
    setWeeklyDigest,
    productNews,
    setProductNews,
  } = props;

  const rows: {
    label: string;
    helper: string;
    value: boolean;
    set: (v: boolean) => void;
  }[] = [
    {
      label: "Email notifications",
      helper: "Updates and summaries by email",
      value: emailNotifs,
      set: setEmailNotifs,
    },
    {
      label: "Mentions",
      helper: "When someone @-mentions you",
      value: mentions,
      set: setMentions,
    },
    {
      label: "Weekly digest",
      helper: "A summary of activity every Monday",
      value: weeklyDigest,
      set: setWeeklyDigest,
    },
    {
      label: "Product news",
      helper: "Occasional news about new features",
      value: productNews,
      set: setProductNews,
    },
  ];

  return (
    <div className="card" style={{ marginTop: 28, border: "1px solid var(--line)", overflow: "hidden" }}>
      {rows.map((r, i) => (
        <PrefRow
          key={r.label}
          first={i === 0}
          label={r.label}
          helper={r.helper}
          control={
            <button
              className={`toggle${r.value ? " on" : ""}`}
              aria-label={r.label}
              aria-pressed={r.value}
              onClick={() => r.set(!r.value)}
            />
          }
        />
      ))}
    </div>
  );
}

/* ————— shared divided row ————— */
function PrefRow(props: {
  label: string;
  helper: string;
  control: ReactNode;
  first?: boolean;
}) {
  const { label, helper, control, first } = props;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 16px",
        borderTop: first ? "none" : "1px solid var(--line-soft)",
      }}
    >
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3 }}>{helper}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}
