import { describe, it, expect } from "vitest";
import { classify } from "../router";

describe("classify (single-source shortcuts)", () => {
  it("routes to database when only a DB map exists", async () => {
    expect(await classify("anything", true, false)).toBe("database");
  });
  it("routes to content when only documents exist", async () => {
    expect(await classify("anything", false, true)).toBe("content");
  });
  // The both-available branch calls the LLM (covered by the live e2e test).
});
