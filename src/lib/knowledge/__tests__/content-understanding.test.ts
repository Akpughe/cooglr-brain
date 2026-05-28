import { describe, it, expect } from "vitest";
import { aggregateContentMap, contentMapOverview, type ContentPageRow } from "../content-understanding";

const pages: ContentPageRow[] = [
  { title: "Invoice 1", frontmatter: { category: "invoice", topics: ["billing"], entities: [{ name: "Resend", type: "org" }] } },
  { title: "Invoice 2", frontmatter: { category: "invoice", topics: ["billing", "q2"], entities: [{ name: "Resend", type: "org" }] } },
  { title: "Zoom invite", frontmatter: { category: "meeting", topics: ["q2"], entities: [{ name: "Stacy", type: "person" }] } },
  { title: "Stray", frontmatter: null },
];

describe("aggregateContentMap", () => {
  const map = aggregateContentMap(pages);

  it("counts categories, sorted desc", () => {
    expect(map.documentCount).toBe(4);
    expect(map.categories[0]).toEqual({ name: "invoice", count: 2 });
    expect(map.categories).toContainEqual({ name: "meeting", count: 1 });
  });

  it("aggregates topics and entities", () => {
    expect(map.topics.find((t) => t.name === "billing")?.count).toBe(2);
    expect(map.topics.find((t) => t.name === "q2")?.count).toBe(2);
    expect(map.entities.find((e) => e.name === "Resend")?.count).toBe(2);
  });

  it("tolerates pages with null frontmatter", () => {
    expect(() => aggregateContentMap(pages)).not.toThrow();
  });
});

describe("contentMapOverview", () => {
  it("summarizes the map as a sentence", () => {
    const o = contentMapOverview(aggregateContentMap(pages));
    expect(o).toContain("4 indexed documents");
    expect(o).toContain("invoice (2)");
  });
  it("is empty when no documents", () => {
    expect(contentMapOverview(aggregateContentMap([]))).toBe("");
  });
});
