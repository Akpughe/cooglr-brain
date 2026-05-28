import { Composio } from "@composio/core";

// Singleton Composio client. COMPOSIO_API_KEY from env; auth-config ids (per
// toolkit, created in the Composio dashboard) are read where needed.
let client: Composio | null = null;

export function getComposio(): Composio {
  if (client) return client;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("COMPOSIO_API_KEY not configured");
  client = new Composio({ apiKey });
  return client;
}
