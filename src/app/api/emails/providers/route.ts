import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  const query = supabase
    .from("email_providers")
    .select("id, name, display_name, from_email, from_name, reply_to_email, is_default, status, created_at")
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query.eq("workspace_id", workspaceId);
  } else {
    query.eq("user_id", user.id);
  }

  const { data } = await query;

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, apiKey, fromEmail, fromName, replyToEmail, displayName, workspaceId } = await request.json();
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
  const countQuery = supabase
    .from("email_providers")
    .select("id", { count: "exact", head: true });

  if (workspaceId) {
    countQuery.eq("workspace_id", workspaceId);
  } else {
    countQuery.eq("user_id", user.id);
  }

  const { count } = await countQuery;
  const isDefault = (count || 0) === 0;

  const { data, error } = await supabase
    .from("email_providers")
    .insert({
      user_id: user.id,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
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

  const { id, apiKey, fromEmail, fromName, displayName, replyToEmail, workspaceId } = await request.json();
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

  const updateQuery = supabase
    .from("email_providers")
    .update(updateData)
    .eq("id", id);

  if (workspaceId) {
    updateQuery.eq("workspace_id", workspaceId);
  } else {
    updateQuery.eq("user_id", user.id);
  }

  const { error } = await updateQuery;

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

  const { id, workspaceId } = await request.json();
  if (!id) return NextResponse.json({ error: "Provider ID required" }, { status: 400 });

  const deleteQuery = supabase
    .from("email_providers")
    .delete()
    .eq("id", id);

  if (workspaceId) {
    deleteQuery.eq("workspace_id", workspaceId);
  } else {
    deleteQuery.eq("user_id", user.id);
  }

  await deleteQuery;

  return NextResponse.json({ ok: true });
}

// Helper to get decrypted provider for internal use
export async function getProvider(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, providerId?: string, workspaceId?: string) {
  const query = supabase
    .from("email_providers")
    .select("*")
    .eq("status", "active");

  if (workspaceId) {
    query.eq("workspace_id", workspaceId);
  } else {
    query.eq("user_id", userId);
  }

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
