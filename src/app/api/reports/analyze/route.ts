import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, columns, rows, rowCount } = await request.json();
  if (!prompt || !columns || !rows) {
    return NextResponse.json({ error: "prompt, columns, and rows required" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });

  // Prepare a data summary for the AI (limit to 20 rows to fit context)
  const sampleRows = rows.slice(0, 20);
  const dataPreview = sampleRows.map((row: Record<string, unknown>) =>
    columns.map((col: string) => `${col}: ${row[col]}`).join(" | ")
  ).join("\n");

  const aiPrompt = `You are a senior McKinsey consultant creating an executive report. Analyze this data and produce a structured report.

USER QUESTION: "${prompt}"

DATA SUMMARY:
- ${rowCount} total rows
- Columns: ${columns.join(", ")}

DATA SAMPLE (first ${sampleRows.length} rows):
${dataPreview}

Generate a JSON response with this EXACT structure (no markdown, no code fences):
{
  "title": "Report title — professional and specific",
  "executiveSummary": "2-3 sentences summarizing the key finding. Be specific with numbers.",
  "keyMetrics": [
    {"label": "Metric Name", "value": "formatted value like ₦5.38M or 258", "change": "+23% (optional, can be null)"},
    {"label": "Metric 2", "value": "value", "change": null}
  ],
  "chart": {
    "type": "bar or line or pie",
    "title": "Chart title",
    "data": [
      {"name": "Label 1", "value": 1234},
      {"name": "Label 2", "value": 5678}
    ],
    "dataKey": "value",
    "nameKey": "name"
  },
  "insights": [
    "Specific insight with numbers — e.g. 'Jollof next accounts for 44% of total revenue'",
    "Another specific insight",
    "Pattern or anomaly noticed"
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2",
    "Actionable recommendation 3"
  ]
}

RULES:
- keyMetrics should have 3-4 items max
- Chart data should have 5-10 items max
- Pick the best chart type: bar for comparisons, line for time series, pie for proportions
- All insights must reference specific numbers from the data
- Recommendations must be actionable business advice
- Use currency symbols where appropriate (₦ for Naira if it looks like NGN amounts)
- Output ONLY the JSON object, nothing else`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "AI analysis failed" }, { status: 500 });
    }

    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    text = text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();

    const report = JSON.parse(text);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}
