import { describe, it, expect } from "vitest";
import { toSourceCatalog } from "../sources-tools";

describe("toSourceCatalog", () => {
  it("normalizes timeline items into a compact catalog", () => {
    const out = toSourceCatalog([
      { documentId: "1", title: "instagram-60-post-calendar.csv", source: "file", reference: "file-1" },
      { documentId: "2", title: "research-brief.md", source: "file", reference: "file-2" },
    ]);
    expect(out).toEqual([
      { title: "instagram-60-post-calendar.csv", type: "documents", reference: "file-1" },
      { title: "research-brief.md", type: "documents", reference: "file-2" },
    ]);
  });

  it("dedupes by title and falls back to 'Untitled' / 'documents'", () => {
    const out = toSourceCatalog([
      { documentId: "1", title: "dup.csv", source: "file" },
      { documentId: "2", title: "dup.csv", source: "file" },
      { documentId: "3" },
    ]);
    expect(out).toEqual([
      { title: "dup.csv", type: "documents", reference: undefined },
      { title: "Untitled", type: "documents", reference: undefined },
    ]);
  });
});
