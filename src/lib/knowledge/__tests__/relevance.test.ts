import { describe, it, expect } from "vitest";
import { topScore, isWeakResult, WEAK_SCORE_FLOOR } from "../relevance";

describe("relevance helpers", () => {
  it("topScore returns the max, or 0 for empty", () => {
    expect(topScore([0.1, 0.9, 0.4])).toBe(0.9);
    expect(topScore([])).toBe(0);
  });

  it("isWeakResult is true for empty results", () => {
    expect(isWeakResult([])).toBe(true);
  });

  it("isWeakResult is true when the best score is below the floor", () => {
    expect(isWeakResult([WEAK_SCORE_FLOOR - 0.01])).toBe(true);
  });

  it("isWeakResult is false when a score meets the floor", () => {
    expect(isWeakResult([WEAK_SCORE_FLOOR, 0.1])).toBe(false);
  });
});
