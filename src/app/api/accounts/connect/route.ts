import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OAUTH_PROVIDERS } from "@/types/accounts";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = request.nextUrl.searchParams.get("provider");
  if (!provider || !OAUTH_PROVIDERS[provider]) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const config = OAUTH_PROVIDERS[provider];
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  if (!clientId) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 500 });
  }

  const { createHmac, randomBytes } = await import("crypto");
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ provider, userId: user.id, nonce });
  const hmac = createHmac("sha256", process.env.CREDENTIAL_ENCRYPTION_KEY!)
    .update(payload)
    .digest("hex");
  const state = Buffer.from(JSON.stringify({ payload, hmac })).toString("base64url");
  const redirectUri = `${request.nextUrl.origin}/api/accounts/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(" "),
    state,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`${config.authUrl}?${params.toString()}`);
}
