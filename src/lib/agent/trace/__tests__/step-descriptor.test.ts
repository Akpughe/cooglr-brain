import { describe, it, expect } from "vitest";
import { describeStep } from "../step-descriptor";

describe("describeStep", () => {
  it("returns null for a text-only step (no tool calls = the final answer)", () => {
    expect(describeStep({ text: "Here are the 5 posts…", toolCalls: [], toolResults: [] })).toBeNull();
    expect(describeStep({ text: "hi" })).toBeNull();
  });

  it("describes an ask_workspace_knowledge step with a weak result", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "ask_workspace_knowledge", args: { question: "content next 5 days" } }],
      toolResults: [{ toolName: "ask_workspace_knowledge", result: { weak: true, citations: [] } }],
    });
    expect(d).toEqual({ tool: "ask_workspace_knowledge", query: "content next 5 days", weak: true, sourceCount: 0 });
  });

  it("describes a strong knowledge result with a source count", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "ask_workspace_knowledge", args: { question: "q" } }],
      toolResults: [{ toolName: "ask_workspace_knowledge", result: { weak: false, citations: [{ fileId: "a" }, { fileId: "b" }] } }],
    });
    expect(d).toEqual({ tool: "ask_workspace_knowledge", query: "q", weak: false, sourceCount: 2 });
  });

  it("describes a list_workspace_sources step (sources array → count)", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "list_workspace_sources", args: {} }],
      toolResults: [{ toolName: "list_workspace_sources", result: { sources: [{ title: "x" }, { title: "y" }, { title: "z" }] } }],
    });
    expect(d).toEqual({ tool: "list_workspace_sources", sourceCount: 3 });
  });

  it("tolerates input/output field aliases and uses the last tool call", () => {
    const d = describeStep({
      toolCalls: [{ toolName: "list_workspace_sources", input: {} }, { toolName: "ask_workspace_knowledge", input: { query: "later" } }],
      toolResults: [{ toolName: "ask_workspace_knowledge", output: { weak: false, citations: [{ fileId: "a" }] } }],
    });
    expect(d).toEqual({ tool: "ask_workspace_knowledge", query: "later", weak: false, sourceCount: 1 });
  });

  it("returns null when the last tool call has no toolName", () => {
    expect(describeStep({ toolCalls: [{ args: {} }], toolResults: [] })).toBeNull();
  });
});
