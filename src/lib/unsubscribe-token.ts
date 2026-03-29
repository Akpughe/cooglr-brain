import { createHmac } from "crypto";

const SECRET = process.env.CREDENTIAL_ENCRYPTION_KEY || "fallback-key";

export function signUnsubscribeToken(userId: string, email: string, campaignId: string): string {
  const payload = `${userId}:${email}:${campaignId}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex").substring(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyUnsubscribeToken(token: string): { userId: string; email: string; campaignId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length < 4) return null;

    const sig = parts.pop()!;
    const campaignId = parts.pop()!;
    const email = parts.pop()!;
    const userId = parts.join(":"); // handle UUIDs with colons (shouldn't happen, but safe)

    const expectedSig = createHmac("sha256", SECRET)
      .update(`${userId}:${email}:${campaignId}`)
      .digest("hex")
      .substring(0, 16);

    if (sig !== expectedSig) return null;
    return { userId, email, campaignId };
  } catch {
    return null;
  }
}
