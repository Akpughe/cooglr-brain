// A system note carrying "today" into the agent run, so it can resolve
// relative ranges ("next 5 days", "this week", "upcoming") to absolute dates.
// Uses server time (UTC date); good enough for day-granularity reasoning.

export function buildDateSystemNote(now: Date): string {
  const iso = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const weekday = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return `Today's date is ${iso} (${weekday}). When a question uses a relative time range (e.g. "next 5 days", "this week", "upcoming", "recent"), convert it to an explicit absolute date range from today before searching.`;
}
