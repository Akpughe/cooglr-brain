"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace/context";
import {
  GitHubLogo,
  GmailLogo,
  GoogleDriveLogo,
  SlackLogo,
} from "./agent-brand-icons";

type BrandLogo = ComponentType<{ className?: string }>;

interface Connector {
  key: string;
  name: string;
  desc: string;
  logo: BrandLogo;
  /** The real OAuth provider key (from /api/accounts) this connector maps to.
   *  Undefined means no OAuth flow exists yet (e.g. Slack). */
  provider?: string;
}

interface Category {
  label: string;
  connectors: Connector[];
}

const CATEGORIES: Category[] = [
  {
    label: "Messaging & Email",
    connectors: [
      {
        key: "slack",
        name: "Slack",
        desc: "Threads, channels, and customer chats",
        logo: SlackLogo,
        // No Slack OAuth provider exists in the registry yet.
      },
      {
        key: "gmail",
        name: "Gmail",
        desc: "Customer email and inbox triage",
        logo: GmailLogo,
        provider: "google",
      },
    ],
  },
  {
    label: "Code & Files",
    connectors: [
      {
        key: "github",
        name: "GitHub",
        desc: "Repos, issues, and pull requests",
        logo: GitHubLogo,
        provider: "github",
      },
      {
        key: "drive",
        name: "Google Drive",
        desc: "Docs, briefs, and reports",
        logo: GoogleDriveLogo,
        provider: "google",
      },
    ],
  },
];

function ConnectorRow({
  connector,
  connected,
}: {
  connector: Connector;
  connected: boolean;
}) {
  const Logo = connector.logo;

  function onConnect() {
    if (!connector.provider) {
      toast("Connector flow coming soon");
      return;
    }
    window.location.href = `/api/accounts/connect?provider=${connector.provider}`;
  }

  return (
    <div className="lrow" style={{ cursor: "default" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f7",
          flexShrink: 0,
        }}
      >
        <Logo className="agent-connector-logo" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--ink)" }}>
          {connector.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{connector.desc}</div>
      </div>
      {connected ? (
        <span
          aria-label={`${connector.name} connected`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 26,
            padding: "0 10px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 500,
            background: "#e9f7ee",
            color: "#157f3d",
            flexShrink: 0,
          }}
        >
          <Check size={12} aria-hidden="true" />
          Connected
        </span>
      ) : (
        <button
          type="button"
          className="btn btn-outline"
          aria-label={`Connect ${connector.name}`}
          onClick={onConnect}
          style={{
            height: 30,
            padding: "0 14px",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          Connect
        </button>
      )}
    </div>
  );
}

export function AgentPluginsView() {
  useWorkspace(); // ensure rendered within a workspace context
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) throw new Error("not ok");
        const data: unknown = await res.json();
        const providers = Array.isArray(data)
          ? data
              .map((a) =>
                a && typeof a === "object" && "provider" in a
                  ? String((a as { provider: unknown }).provider)
                  : null
              )
              .filter((p): p is string => Boolean(p))
          : [];
        if (active) setConnectedProviders(new Set(providers));
      } catch {
        // Degrade gracefully: show everything as not-connected.
        if (active) setConnectedProviders(new Set());
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <style>{`.agent-connector-logo { width: 20px; height: 20px; display: block; }`}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 40px 40px" }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.018em",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Connectors
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 4 }}>
          Connect your tools so the agent can search and act across them.
        </p>

        {CATEGORIES.map((category) => (
          <div key={category.label}>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-3)",
                margin: "22px 0 8px",
                fontWeight: 500,
              }}
            >
              {category.label}
            </div>
            <div
              className="card"
              style={{
                background: "var(--bg)",
                borderRadius: "var(--r-card)",
                boxShadow: "var(--shadow-card)",
                overflow: "hidden",
                opacity: loading ? 0.6 : 1,
                transition: "opacity 120ms ease",
              }}
            >
              {category.connectors.map((connector) => (
                <ConnectorRow
                  key={connector.key}
                  connector={connector}
                  connected={
                    !loading &&
                    !!connector.provider &&
                    connectedProviders.has(connector.provider)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
