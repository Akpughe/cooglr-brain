import { describe, it, expect } from "vitest";
import { chunkArray, mapWithConcurrency } from "../chunk";

describe("chunkArray", () => {
  it("splits into chunks of at most size", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns one chunk when size >= length", () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
  });
  it("returns empty for empty input", () => {
    expect(chunkArray([], 3)).toEqual([]);
  });
  it("throws on non-positive size", () => {
    expect(() => chunkArray([1], 0)).toThrow();
  });
});

describe("mapWithConcurrency", () => {
  it("preserves order and maps every item", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });
});
