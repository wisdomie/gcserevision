import type { Rng } from "./types";

/** Raw mulberry32 generator: uniform floats in [0, 1) from a 32-bit state. */
export function mulberry32(state: number): () => number {
  let s = state >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * MurmurHash3 finaliser. Consecutive seeds give strongly correlated first
 * outputs from raw mulberry32 (seeds 2 and 3 start 0.734 and 0.720), so the
 * seed is mixed before use.
 */
export function mixSeed(seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Seeded PRNG (mulberry32 over a mixed seed). The same seed always yields the
 * same sequence, so a question can be reproduced from its stored seed.
 */
export function createRng(seed: number): Rng {
  const next = mulberry32(mixSeed(seed));

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`rng.int: invalid range [${min}, ${max}]`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new RangeError("rng.pick: empty array");
    return arr[int(0, arr.length - 1)];
  };

  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  return { next, int, pick, shuffle };
}

/** A random 32-bit seed for a new question instance (not for tests). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}
