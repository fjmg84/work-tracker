import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./concurrency";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency", () => {
  it("maps all items preserving order", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const results = await mapWithConcurrency(items, 3, async (n) => {
      await delay(Math.random() * 10);
      return n * 2;
    });
    expect(results).toEqual(items.map((n) => n * 2));
  });

  it("never exceeds the concurrency limit", async () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency(items, 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1);
  });

  it("handles an empty array", async () => {
    const results = await mapWithConcurrency([], 4, async (n: number) => n);
    expect(results).toEqual([]);
  });

  it("propagates rejections", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });
});
