import { describe, expect, it } from "vitest";
import { clockOffset, secondsLeft } from "@/lib/game/clock";

describe("clockOffset", () => {
  it("is 0 with no samples", () => {
    expect(clockOffset([])).toBe(0);
  });
  it("assumes the server read its clock halfway through the round trip", () => {
    // Client is 5 s behind the server; 100 ms round trip
    expect(clockOffset([{ sentAt: 1_000, serverNow: 6_050, receivedAt: 1_100 }])).toBe(5_000);
  });
  it("trusts the sample with the shortest round trip", () => {
    const offset = clockOffset([
      { sentAt: 0, serverNow: 2_900, receivedAt: 1_000 }, // slow: suggests 2400
      { sentAt: 2_000, serverNow: 4_020, receivedAt: 2_040 }, // fast: 2000
      { sentAt: 3_000, serverNow: 5_400, receivedAt: 3_300 }, // 2250
    ]);
    expect(offset).toBe(2_000);
  });
  it("handles a client clock that runs ahead", () => {
    expect(clockOffset([{ sentAt: 10_000, serverNow: 7_010, receivedAt: 10_020 }])).toBe(-3_000);
  });
});

describe("secondsLeft", () => {
  it("counts down whole seconds against the server deadline", () => {
    expect(secondsLeft(30_000, 0, 0)).toBe(30);
    expect(secondsLeft(30_000, 0, 500)).toBe(30); // 29.5 s rounds up
    expect(secondsLeft(30_000, 29_001, 0)).toBe(1);
    expect(secondsLeft(30_000, 20_000, 5_000)).toBe(5);
  });
  it("never goes below zero", () => {
    expect(secondsLeft(30_000, 30_000, 0)).toBe(0);
    expect(secondsLeft(30_000, 40_000, 0)).toBe(0);
  });
});
