// Thin LLM helper for the knowledge layer. Uses the Gemini REST API today
// (matching src/app/api/reports/analyze/route.ts), behind a single function so
// it can be swapped to the OpenClaw Gateway later without touching callers.

export async function complete(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("AI key not configured (GEMINI_API_KEY)");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
      }),
    },
  );
  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Parse JSON out of a model response, tolerating code fences and leading prose.
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  const start =
    objStart === -1
      ? arrStart
      : arrStart === -1
        ? objStart
        : Math.min(objStart, arrStart);
  if (start === -1) throw new Error("No JSON found in model output");
  return JSON.parse(cleaned.slice(start)) as T;
}
