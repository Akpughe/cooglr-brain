import { getComposio } from "./client";

// Toolkit -> the env var holding its Composio auth-config id (created in the
// Composio dashboard). Add a row here to support a new toolkit's OAuth connect.
const AUTH_CONFIG_ENV: Record<string, string> = {
  gmail: "COMPOSIO_GMAIL_AUTH_CONFIG_ID",
  github: "COMPOSIO_GITHUB_AUTH_CONFIG_ID",
  slack: "COMPOSIO_SLACK_AUTH_CONFIG_ID",
  "google-drive": "COMPOSIO_DRIVE_AUTH_CONFIG_ID",
};

export const SUPPORTED_TOOLKITS = Object.keys(AUTH_CONFIG_ENV);

// Which toolkits currently have an auth config configured (env present).
export function configuredToolkits(): string[] {
  return SUPPORTED_TOOLKITS.filter((t) => Boolean(process.env[AUTH_CONFIG_ENV[t]]));
}

// Start the OAuth connection for any supported toolkit. Returns the hosted
// consent redirect URL.
export async function startConnection(
  userId: string,
  toolkit: string,
): Promise<{ redirectUrl: string; connectionId: string }> {
  const envKey = AUTH_CONFIG_ENV[toolkit];
  if (!envKey) throw new Error(`Unsupported toolkit: ${toolkit}`);
  const authConfigId = process.env[envKey];
  if (!authConfigId) throw new Error(`${envKey} not configured`);
  const conn = await getComposio().connectedAccounts.link(userId, authConfigId);
  if (!conn.redirectUrl) throw new Error("Composio did not return a redirect URL");
  return { redirectUrl: conn.redirectUrl, connectionId: conn.id };
}

// Best-effort: which toolkits this user has an ACTIVE connected account for.
export async function listConnectedToolkits(userId: string): Promise<string[]> {
  try {
    const res = await getComposio().connectedAccounts.list({ userIds: [userId] });
    const items = (res as { items?: { toolkit?: { slug?: string }; status?: string }[] }).items ?? [];
    const active = new Set<string>();
    for (const a of items) {
      const slug = a.toolkit?.slug?.toLowerCase();
      if (slug && (a.status === "ACTIVE" || !a.status)) active.add(slug);
    }
    return [...active];
  } catch {
    return [];
  }
}
