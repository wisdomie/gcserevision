import { describe, expect, it } from "vitest";
import { createRng, mixSeed, mulberry32, randomSeed } from "@/lib/engine/rng";

describe("createRng (mulberry32)", () => {
  it("is deterministic for a seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("mulberry32 matches the reference implementation", () => {
    // First output of the canonical implementation for state 1
    expect(mulberry32(1)()).toBeCloseTo(0.6270739405881613, 15);
  });

  it("mixSeed is a bijection-style scramble that spreads nearby seeds", () => {
    expect(mixSeed(0)).toBe(0);
    expect(new Set(Array.from({ length: 1000 }, (_, i) => mixSeed(i))).size).toBe(1000);
  });

  it("decorrelates the first output of consecutive seeds", () => {
    // Raw mulberry32 gives 0.734 and 0.720 for seeds 2 and 3.
    const firsts = Array.from({ length: 200 }, (_, i) => createRng(i + 1).next());
    const gaps = firsts.slice(1).map((x, i) => Math.abs(x - firsts[i]));
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(meanGap).toBeGreaterThan(0.25); // ~1/3 for independent uniforms
    // First draws of int(1, 25) should be spread out, not clustered
    const draws = new Set(Array.from({ length: 50 }, (_, i) => createRng(i + 1).int(1, 25)));
    expect(draws.size).toBeGreaterThan(15);
  });

  it("gives different sequences for different seeds", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("next() stays in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int() is inclusive and covers the whole range", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const x = rng.int(-2, 3);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x).toBeLessThanOrEqual(3);
      seen.add(x);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3]);
    expect(rng.int(5, 5)).toBe(5);
  });

  it("int() rejects invalid ranges", () => {
    const rng = createRng(1);
    expect(() => rng.int(3, 2)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it("pick() returns an element and rejects empty arrays", () => {
    const rng = createRng(9);
    const arr = ["a", "b", "c"] as const;
    for (let i = 0; i < 50; i++) expect(arr).toContain(rng.pick(arr));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it("shuffle() returns a permutation without mutating the input", () => {
    const rng = createRng(11);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(createRng(11).shuffle(input)).toEqual(out);
  });

  it("randomSeed() returns a uint32", () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
});
