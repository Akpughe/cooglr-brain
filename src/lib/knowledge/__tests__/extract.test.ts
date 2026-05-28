import { describe, it, expect } from "vitest";
import { tiptapToText, nutonText } from "../extract";
import { chunkText } from "../chunk";

describe("tiptapToText", () => {
  it("extracts text from a TipTap doc with block breaks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "Q2 Plan" }] },
        { type: "paragraph", content: [{ type: "text", text: "Launch in June." }] },
        { type: "paragraph", content: [{ type: "text", text: "Budget is 50k." }] },
      ],
    };
    const out = tiptapToText(doc);
    expect(out).toContain("Q2 Plan");
    expect(out).toContain("Launch in June.");
    expect(out).toContain("Budget is 50k.");
  });

  it("handles empty / non-object input", () => {
    expect(tiptapToText(null)).toBe("");
    expect(tiptapToText({})).toBe("");
  });
});

describe("nutonText", () => {
  it("pulls text from nested document objects", () => {
    expect(nutonText({ documents: [{ text: "page one" }, { content: "page two" }] }))
      .toBe("page one\n\npage two");
  });
  it("returns empty when no text fields present", () => {
    expect(nutonText({ status: "ok", meta: { n: 2 } })).toBe("");
  });
});

describe("chunkText", () => {
  it("returns a single chunk when short", () => {
    expect(chunkText("hello world", 1500)).toEqual(["hello world"]);
  });
  it("splits long text into overlapping chunks", () => {
    const text = "word ".repeat(1000); // 5000 chars
    const chunks = chunkText(text, 1000, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
  });
  it("returns empty for blank text", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});
