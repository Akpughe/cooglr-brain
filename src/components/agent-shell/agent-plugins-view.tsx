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
  /** The Composio toolkit slug this connector connects (one connection serves
   *  both reads and the agent's actions). Undefined = no flow yet. */
  toolkit?: string;
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
        toolkit: "slack",
      },
      {
        key: "gmail",
        name: "Gmail",
        desc: "Customer email and inbox triage",
        logo: GmailLogo,
        toolkit: "gmail",
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
        toolkit: "github",
      },
      {
        key: "drive",
        name: "Google Drive",
        desc: "Docs, briefs, and reports",
        logo: GoogleDriveLogo,
        toolkit: "google-drive",
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

  async function onConnect() {
    if (!connector.toolkit) {
      toast("Connector flow coming soon");
      return;
    }
    try {
      const res = await fetch("/api/composio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit: connector.toolkit }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) throw new Error(data.error || "Connect failed");
      window.location.href = data.redirectUrl; // hosted consent flow
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start connection");
    }
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
  const [connectedToolkits, setConnectedToolkits] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/composio/connect");
        if (!res.ok) throw new Error("not ok");
        const data = (await res.json()) as { connected?: unknown };
        const connected = Array.isArray(data.connected)
          ? data.connected.map((t) => String(t).toLowerCase())
          : [];
        if (active) setConnectedToolkits(new Set(connected));
      } catch {
        // Degrade gracefully: show everything as not-connected.
        if (active) setConnectedToolkits(new Set());
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
                    !!connector.toolkit &&
                    connectedToolkits.has(connector.toolkit)
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
