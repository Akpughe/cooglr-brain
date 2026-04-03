import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  const query = supabase
    .from("email_campaigns")
    .select(`
      id, name, subject, status, campaign_type, is_test,
      scheduled_at, scheduled_timezone, started_at, completed_at,
      from_email, from_name, stats, created_at,
      template:email_templates(id, name),
      audience:email_audiences(id, name, contact_count),
      provider:email_providers(id, name, display_name)
    `)
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

  const body = await request.json();
  const {
    name, subject, templateId, audienceId, providerId,
    htmlContent, fromEmail, fromName, replyTo,
    isTest, testRecipients, scheduledAt, scheduledTimezone,
    workspaceId,
  } = body;

  if (!name || !subject) {
    return NextResponse.json({ error: "Campaign name and subject required" }, { status: 400 });
  }

  // If template specified, snapshot its HTML
  let html = htmlContent || "";
  if (templateId && !html) {
    const tplQuery = supabase
      .from("email_templates")
      .select("html_content")
      .eq("id", templateId);
    if (workspaceId) {
      tplQuery.eq("workspace_id", workspaceId);
    } else {
      tplQuery.eq("user_id", user.id);
    }
    const { data: tpl } = await tplQuery.single();
    if (tpl) html = tpl.html_content;
  }

  // Resolve provider
  let resolvedFromEmail = fromEmail || "";
  let resolvedFromName = fromName || "";
  if (!resolvedFromEmail && providerId) {
    const provQuery = supabase
      .from("email_providers")
      .select("from_email, from_name")
      .eq("id", providerId);
    if (workspaceId) {
      provQuery.eq("workspace_id", workspaceId);
    } else {
      provQuery.eq("user_id", user.id);
    }
    const { data: prov } = await provQuery.single();
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
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
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

  const { id, workspaceId, ...updates } = await request.json();
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
    const tplQuery = supabase
      .from("email_templates")
      .select("html_content")
      .eq("id", updates.templateId);
    if (workspaceId) {
      tplQuery.eq("workspace_id", workspaceId);
    } else {
      tplQuery.eq("user_id", user.id);
    }
    const { data: tpl } = await tplQuery.single();
    if (tpl) updateData.html_content = tpl.html_content;
  }

  const patchQuery = supabase
    .from("email_campaigns")
    .update(updateData)
    .eq("id", id);

  if (workspaceId) {
    patchQuery.eq("workspace_id", workspaceId);
  } else {
    patchQuery.eq("user_id", user.id);
  }

  const { error } = await patchQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, workspaceId } = await request.json();
  const deleteQuery = supabase.from("email_campaigns").delete().eq("id", id);
  if (workspaceId) {
    deleteQuery.eq("workspace_id", workspaceId);
  } else {
    deleteQuery.eq("user_id", user.id);
  }
  await deleteQuery;
  return NextResponse.json({ ok: true });
}
