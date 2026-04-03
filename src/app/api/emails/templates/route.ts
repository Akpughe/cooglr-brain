import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  const query = supabase
    .from("email_templates")
    .select("id, name, subject, category, brand_config, variables, is_ai_generated, status, created_at, updated_at")
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

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
  const { workspaceId } = body;

  // AI generation mode
  if (body.action === "generate") {
    return generateTemplate(body, user.id, workspaceId);
  }

  // Manual create/save
  const { name, subject, htmlContent, category, brandConfig, variables } = body;
  if (!name) return NextResponse.json({ error: "Template name required" }, { status: 400 });

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      user_id: user.id,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      name,
      subject: subject || "",
      html_content: htmlContent || "",
      category: category || "marketing",
      brand_config: brandConfig || {},
      variables: variables || [],
      status: "active",
    })
    .select("id, name, subject, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, workspaceId, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "Template ID required" }, { status: 400 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.subject !== undefined) updateData.subject = updates.subject;
  if (updates.htmlContent !== undefined) updateData.html_content = updates.htmlContent;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.brandConfig !== undefined) updateData.brand_config = updates.brandConfig;

  const patchQuery = supabase
    .from("email_templates")
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
  const deleteQuery = supabase.from("email_templates").delete().eq("id", id);
  if (workspaceId) {
    deleteQuery.eq("workspace_id", workspaceId);
  } else {
    deleteQuery.eq("user_id", user.id);
  }
  await deleteQuery;
  return NextResponse.json({ ok: true });
}

async function generateTemplate(body: { prompt: string; brandConfig?: Record<string, unknown>; templateName?: string }, userId: string, workspaceId?: string) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });

  const { prompt, brandConfig, templateName } = body;
  if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const brand = brandConfig || {};
  const brandContext = Object.keys(brand).length > 0
    ? `Brand Guide:
- Name: ${brand.brandName || ""}
- Primary Color: ${brand.primaryColor || "#c2410c"}
- Secondary Color: ${brand.secondaryColor || "#1c1917"}
- Logo URL: ${brand.logoUrl || "none"}
- Tone: ${brand.tone || "professional"}
- Font: ${brand.font || "system default"}`
    : "No brand guide provided — use clean, modern defaults.";

  const systemPrompt = `You are an expert email designer. Generate a complete, responsive HTML email template.

${brandContext}

REQUIREMENTS:
- Table-based layout for Outlook compatibility
- Inline CSS for all styles
- Max width 600px container centered
- Mobile-responsive with @media queries in a <style> tag
- Web-safe fonts with fallbacks
- Alt text on images
- Minimum 44px touch targets for buttons
- Include {{unsubscribe_url}} placeholder in footer
- Include a physical address placeholder in footer
- Use the brand colors throughout
- Clean, modern design

USER REQUEST: "${prompt}"

Output ONLY the complete HTML — no markdown, no explanation, no code fences.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "AI generation failed" }, { status: 500 });
    }

    const data = await res.json();
    let html = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

    if (!html) return NextResponse.json({ error: "AI could not generate template" }, { status: 500 });

    // Extract subject from HTML title tag if present
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const subject = titleMatch?.[1] || "";

    // Generate plain text fallback
    const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 500);

    // Save to database
    const supabase = await createClient();
    const { data: template, error } = await supabase
      .from("email_templates")
      .insert({
        user_id: userId,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        name: templateName || "AI Generated Template",
        subject,
        html_content: html,
        text_content: textContent,
        brand_config: brandConfig || {},
        is_ai_generated: true,
        ai_prompt: prompt,
        status: "active",
      })
      .select("id, name, subject, html_content, status, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 });
  }
}
