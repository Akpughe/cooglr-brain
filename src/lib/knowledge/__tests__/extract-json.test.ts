import { describe, it, expect } from "vitest";
import { extractJson } from "../llm";

describe("extractJson", () => {
  it("strips code fences and parses an object", () => {
    expect(extractJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("tolerates leading prose before the JSON", () => {
    expect(extractJson<{ ok: boolean }>('Here you go:\n{"ok":true}')).toEqual({
      ok: true,
    });
  });

  it("parses a top-level array", () => {
    expect(extractJson<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
