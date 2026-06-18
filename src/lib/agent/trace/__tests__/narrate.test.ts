import { describe, it, expect } from "vitest";
import { fallbackLabel } from "../narrate";

describe("fallbackLabel", () => {
  it("labels a source-discovery step", () => {
    expect(fallbackLabel({ tool: "list_workspace_sources", sourceCount: 3 })).toBe("Checked what's available in the workspace.");
  });
  it("labels a weak knowledge search", () => {
    expect(fallbackLabel({ tool: "ask_workspace_knowledge", weak: true })).toBe("Searched the workspace — the first results looked thin.");
  });
  it("labels a normal knowledge search", () => {
    expect(fallbackLabel({ tool: "ask_workspace_knowledge", weak: false })).toBe("Searched the workspace for an answer.");
  });
  it("labels an unknown tool generically", () => {
    expect(fallbackLabel({ tool: "gmail_search" })).toBe("Used gmail_search.");
  });
});
