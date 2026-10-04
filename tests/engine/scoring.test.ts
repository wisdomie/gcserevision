import { describe, expect, it } from "vitest";
import {
  compareDuel,
  elapsedMs,
  isLate,
  LATE_GRACE_MS,
  LATENCY_GRACE_MS,
  livePoints,
  nextStreak,
  soloPoints,
  streakBonus,
} from "@/lib/engine/scoring";

const live = (over: Partial<Parameters<typeof livePoints>[0]> = {}) =>
  livePoints({
    correct: true,
    marksAwarded: 1,
    totalMarks: 1,
    elapsedMs: 0,
    secondsPerQuestion: 30,
    streakAfterThisAnswer: 1,
    ...over,
  });

describe("streaks", () => {
  it("increments on correct and resets on wrong", () => {
    expect(nextStreak(0, true)).toBe(1);
    expect(nextStreak(4, true)).toBe(5);
    expect(nextStreak(4, false)).toBe(0);
  });
  it("bonus starts at the third in a row and caps at 500", () => {
    expect([0, 1, 2, 3, 4, 7, 8, 50].map(streakBonus)).toEqual([0, 0, 0, 100, 200, 500, 500, 500]);
  });
});

describe("timing", () => {
  it("subtracts the latency grace and floors at 0", () => {
    expect(elapsedMs(10_000, 0)).toBe(10_000 - LATENCY_GRACE_MS);
    expect(elapsedMs(100, 0)).toBe(0);
    expect(elapsedMs(0, 1000)).toBe(0);
  });
  it("accepts answers up to the late grace after the deadline", () => {
    expect(isLate(30_000, 30_000)).toBe(false);
    expect(isLate(30_000 + LATE_GRACE_MS, 30_000)).toBe(false);
    expect(isLate(30_000 + LATE_GRACE_MS + 1, 30_000)).toBe(true);
  });
});

describe("livePoints", () => {
  it("gives 1000 for an instant correct answer and 500 at the deadline", () => {
    expect(live({ elapsedMs: 0 })).toBe(1000);
    expect(live({ elapsedMs: 15_000 })).toBe(750);
    expect(live({ elapsedMs: 30_000 })).toBe(500);
  });
  it("clamps elapsed time outside the window", () => {
    expect(live({ elapsedMs: 90_000 })).toBe(500);
    expect(live({ elapsedMs: -5 })).toBe(1000);
  });
  it("scores 0 for a wrong answer, with no streak bonus", () => {
    expect(live({ correct: false, marksAwarded: 0, streakAfterThisAnswer: 0 })).toBe(0);
  });
  it("adds the streak bonus to correct answers", () => {
    expect(live({ streakAfterThisAnswer: 3 })).toBe(1100);
    expect(live({ streakAfterThisAnswer: 10, elapsedMs: 30_000 })).toBe(1000);
  });
  it("scales partial marks and withholds the streak bonus", () => {
    expect(live({ correct: false, marksAwarded: 1, totalMarks: 2, streakAfterThisAnswer: 0 })).toBe(
      500,
    );
    expect(live({ correct: false, marksAwarded: 1, totalMarks: 3, elapsedMs: 0 })).toBe(333);
  });
  it("guards against bad mark totals", () => {
    expect(live({ totalMarks: 0 })).toBe(0);
    expect(live({ marksAwarded: 5, totalMarks: 2 })).toBe(1000);
  });
  it("rounds the base score", () => {
    expect(live({ elapsedMs: 1, secondsPerQuestion: 30 })).toBe(1000);
    expect(live({ elapsedMs: 100, secondsPerQuestion: 7 })).toBe(993);
  });
});

describe("soloPoints", () => {
  it("is 100 per mark plus streak bonus", () => {
    expect(soloPoints({ correct: true, marksAwarded: 2, streakAfterThisAnswer: 1 })).toBe(200);
    expect(soloPoints({ correct: true, marksAwarded: 1, streakAfterThisAnswer: 4 })).toBe(300);
    expect(soloPoints({ correct: false, marksAwarded: 0, streakAfterThisAnswer: 0 })).toBe(0);
    expect(soloPoints({ correct: false, marksAwarded: 1, streakAfterThisAnswer: 5 })).toBe(100);
  });
  it("applies the time formula when timed", () => {
    expect(
      soloPoints({
        correct: true,
        marksAwarded: 2,
        streakAfterThisAnswer: 1,
        timed: { elapsedMs: 30_000, secondsPerQuestion: 30 },
      }),
    ).toBe(100);
  });
});

describe("compareDuel", () => {
  it("ranks by score, then by lower time on correct answers", () => {
    const players = [
      { id: "a", score: 3000, correctTimeMs: 9000 },
      { id: "b", score: 3500, correctTimeMs: 20000 },
      { id: "c", score: 3000, correctTimeMs: 7000 },
    ];
    expect([...players].sort(compareDuel).map((p) => p.id)).toEqual(["b", "c", "a"]);
  });
});
