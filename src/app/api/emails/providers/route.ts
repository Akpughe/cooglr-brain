import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("email_providers")
    .select("id, name, display_name, from_email, from_name, reply_to_email, is_default, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, apiKey, fromEmail, fromName, replyToEmail, displayName } = await request.json();
  if (!name || !apiKey || !fromEmail) {
    return NextResponse.json({ error: "Provider name, API key, and from email are required" }, { status: 400 });
  }

  // Test the API key with the provider
  try {
    if (name === "resend") {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      // Verify by listing domains — lightweight check
      await resend.domains.list();
    }
  } catch (err) {
    return NextResponse.json({ error: `Invalid API key: ${err instanceof Error ? err.message : "Connection failed"}` }, { status: 400 });
  }

  // If this is first provider, make it default
  const { count } = await supabase
    .from("email_providers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const isDefault = (count || 0) === 0;

  const { data, error } = await supabase
    .from("email_providers")
    .insert({
      user_id: user.id,
      name,
      display_name: displayName || name,
      encrypted_api_key: encrypt(apiKey),
      from_email: fromEmail,
      from_name: fromName || null,
      reply_to_email: replyToEmail || null,
      is_default: isDefault,
      status: "active",
    })
    .select("id, name, display_name, from_email, from_name, is_default, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, apiKey, fromEmail, fromName, displayName, replyToEmail } = await request.json();
  if (!id) return NextResponse.json({ error: "Provider ID required" }, { status: 400 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // If API key changed, verify it
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      await resend.domains.list();
    } catch (err) {
      return NextResponse.json({ error: `Invalid API key: ${err instanceof Error ? err.message : "Connection failed"}` }, { status: 400 });
    }
    updateData.encrypted_api_key = encrypt(apiKey);
  }

  if (fromEmail !== undefined) updateData.from_email = fromEmail;
  if (fromName !== undefined) updateData.from_name = fromName || null;
  if (displayName !== undefined) updateData.display_name = displayName;
  if (replyToEmail !== undefined) updateData.reply_to_email = replyToEmail || null;

  const { error } = await supabase
    .from("email_providers")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return updated provider
  const { data } = await supabase
    .from("email_providers")
    .select("id, name, display_name, from_email, from_name, reply_to_email, is_default, status")
    .eq("id", id)
    .single();

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Provider ID required" }, { status: 400 });

  await supabase
    .from("email_providers")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

// Helper to get decrypted provider for internal use
export async function getProvider(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, providerId?: string) {
  const query = supabase
    .from("email_providers")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  if (providerId) {
    query.eq("id", providerId);
  } else {
    query.eq("is_default", true);
  }

  const { data } = await query.single();
  if (!data) return null;

  return {
    ...data,
    api_key: decrypt(data.encrypted_api_key),
  };
}
