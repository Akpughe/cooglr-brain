import { decrypt } from "@/lib/crypto";

export async function getUserToken(
  supabase: { from: Function },
  userId: string,
  provider: string
): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("external_accounts")
    .select("encrypted_access_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (!data?.encrypted_access_token) return null;

  try {
    return decrypt(data.encrypted_access_token as string);
  } catch {
    return null;
  }
}
