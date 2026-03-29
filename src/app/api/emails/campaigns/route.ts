import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("email_campaigns")
    .select(`
      id, name, subject, status, campaign_type, is_test,
      scheduled_at, scheduled_timezone, started_at, completed_at,
      from_email, from_name, stats, created_at,
      template:email_templates(id, name),
      audience:email_audiences(id, name, contact_count),
      provider:email_providers(id, name, display_name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name, subject, templateId, audienceId, providerId,
    htmlContent, fromEmail, fromName, replyTo,
    isTest, testRecipients, scheduledAt, scheduledTimezone,
  } = body;

  if (!name || !subject) {
    return NextResponse.json({ error: "Campaign name and subject required" }, { status: 400 });
  }

  // If template specified, snapshot its HTML
  let html = htmlContent || "";
  if (templateId && !html) {
    const { data: tpl } = await supabase
      .from("email_templates")
      .select("html_content")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .single();
    if (tpl) html = tpl.html_content;
  }

  // Resolve provider
  let resolvedFromEmail = fromEmail || "";
  let resolvedFromName = fromName || "";
  if (!resolvedFromEmail && providerId) {
    const { data: prov } = await supabase
      .from("email_providers")
      .select("from_email, from_name")
      .eq("id", providerId)
      .eq("user_id", user.id)
      .single();
    if (prov) {
      resolvedFromEmail = prov.from_email;
      resolvedFromName = prov.from_name || "";
    }
  }

  const status = scheduledAt ? "scheduled" : "draft";

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      user_id: user.id,
      name,
      subject,
      template_id: templateId || null,
      audience_id: audienceId || null,
      provider_id: providerId || null,
      html_content: html,
      from_email: resolvedFromEmail,
      from_name: resolvedFromName,
      reply_to: replyTo || null,
      is_test: isTest || false,
      test_recipients: testRecipients || [],
      scheduled_at: scheduledAt || null,
      scheduled_timezone: scheduledTimezone || null,
      status,
    })
    .select("id, name, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.subject !== undefined) updateData.subject = updates.subject;
  if (updates.fromName !== undefined) updateData.from_name = updates.fromName;
  if (updates.fromEmail !== undefined) updateData.from_email = updates.fromEmail;
  if (updates.replyTo !== undefined) updateData.reply_to = updates.replyTo;
  if (updates.isTest !== undefined) updateData.is_test = updates.isTest;
  if (updates.testRecipients !== undefined) updateData.test_recipients = updates.testRecipients;
  if (updates.templateId !== undefined) updateData.template_id = updates.templateId;
  if (updates.audienceId !== undefined) updateData.audience_id = updates.audienceId;
  if (updates.htmlContent !== undefined) updateData.html_content = updates.htmlContent;
  if (updates.scheduledAt !== undefined) {
    updateData.scheduled_at = updates.scheduledAt;
    updateData.status = updates.scheduledAt ? "scheduled" : "draft";
  }
  if (updates.scheduledTimezone !== undefined) updateData.scheduled_timezone = updates.scheduledTimezone;

  // If editing a sent test campaign, also snapshot new template content
  if (updates.templateId && !updates.htmlContent) {
    const { data: tpl } = await supabase
      .from("email_templates")
      .select("html_content")
      .eq("id", updates.templateId)
      .eq("user_id", user.id)
      .single();
    if (tpl) updateData.html_content = tpl.html_content;
  }

  const { error } = await supabase
    .from("email_campaigns")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  await supabase.from("email_campaigns").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
