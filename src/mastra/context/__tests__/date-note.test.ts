import { describe, it, expect } from "vitest";
import { buildDateSystemNote } from "../date-note";

describe("buildDateSystemNote", () => {
  it("includes the ISO date for relative date math", () => {
    const note = buildDateSystemNote(new Date("2026-06-17T09:00:00Z"));
    expect(note).toContain("2026-06-17");
  });

  it("instructs the agent to use it for relative ranges", () => {
    const note = buildDateSystemNote(new Date("2026-06-17T09:00:00Z"));
    expect(note.toLowerCase()).toContain("relative");
  });
});
