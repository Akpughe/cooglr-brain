import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { OAUTH_PROVIDERS } from "@/types/accounts";
import { encrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=missing_params`);
  }

  let state: { provider: string; userId: string };
  try {
    const { createHmac } = await import("crypto");
    const outer = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    const expectedHmac = createHmac("sha256", process.env.CREDENTIAL_ENCRYPTION_KEY!)
      .update(outer.payload)
      .digest("hex");
    if (expectedHmac !== outer.hmac) {
      return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=invalid_state`);
    }
    state = JSON.parse(outer.payload);
  } catch {
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=invalid_state`);
  }

  const config = OAUTH_PROVIDERS[state.provider];
  if (!config) {
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=invalid_provider`);
  }

  const clientId = process.env[`${state.provider.toUpperCase()}_CLIENT_ID`]!;
  const clientSecret = process.env[`${state.provider.toUpperCase()}_CLIENT_SECRET`]!;
  const redirectUri = `${request.nextUrl.origin}/api/accounts/callback`;

  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.access_token) {
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=token_exchange_failed`);
  }

  let providerEmail = "";
  let providerUsername = "";
  let providerUserId = "";

  if (state.provider === "github") {
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const ghUser = await userRes.json();
    providerEmail = ghUser.email || "";
    providerUsername = ghUser.login;
    providerUserId = String(ghUser.id);
  } else if (state.provider === "google") {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await userRes.json();
    providerEmail = gUser.email;
    providerUsername = gUser.name;
    providerUserId = gUser.id;
  }

  const supabase = await createServiceClient();

  await supabase.from("external_accounts").upsert(
    {
      user_id: state.userId,
      provider: state.provider,
      provider_user_id: providerUserId,
      provider_email: providerEmail,
      provider_username: providerUsername,
      encrypted_access_token: encrypt(tokens.access_token),
      encrypted_refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      scopes: tokens.scope ? tokens.scope.split(/[, ]+/) : config.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  return NextResponse.redirect(`${request.nextUrl.origin}/settings?connected=${state.provider}`);
}
