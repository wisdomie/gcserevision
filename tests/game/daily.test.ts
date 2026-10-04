import { describe, expect, it } from "vitest";
import { listGenerators } from "@/lib/engine/generators/registry";
import {
  DAILY_COUNT,
  dailyDate,
  dailyEligible,
  dailyShareText,
  formatDailyDate,
  planDaily,
} from "@/lib/game/daily";

describe("dailyDate", () => {
  it("uses UK time, so British summer time moves midnight", () => {
    // 23:30 UTC on 4 October is 00:30 BST on 5 October
    expect(dailyDate(new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05");
    expect(dailyDate(new Date("2026-10-04T22:59:00Z"))).toBe("2026-10-04");
    // In winter UK time is UTC
    expect(dailyDate(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
    expect(dailyDate(new Date("2026-12-02T00:00:00Z"))).toBe("2026-12-02");
  });

  it("formats a date for people", () => {
    expect(formatDailyDate("2026-10-04")).toBe("Sunday 4 October");
  });
});

describe("planDaily", () => {
  const eligible = dailyEligible(listGenerators());

  it("only uses questions that suit every tier and board", () => {
    expect(eligible.length).toBeGreaterThanOrEqual(DAILY_COUNT);
    for (const g of eligible) {
      expect(g.tiers).toEqual(expect.arrayContaining(["foundation", "higher"]));
      expect(g.boards).toBe("all");
    }
  });

  it("is deterministic for a seed", () => {
    expect(planDaily(eligible, 42)).toEqual(planDaily(eligible, 42));
    expect(planDaily(eligible, 42)).not.toEqual(planDaily(eligible, 43));
  });

  it("picks five questions from different topics, easiest first", () => {
    for (let seed = 0; seed < 300; seed++) {
      const plan = planDaily(eligible, seed);
      expect(plan).toHaveLength(DAILY_COUNT);
      const gens = plan.map((p) => eligible.find((g) => g.key === p.key)!);
      expect(new Set(gens.map((g) => g.topicSlug)).size).toBe(DAILY_COUNT);
      const difficulties = gens.map((g) => g.difficulty);
      expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
    }
  });

  it("still fills the day when there are few generators", () => {
    const one = eligible.slice(0, 1);
    expect(planDaily(one, 1).map((p) => p.key)).toEqual(Array(DAILY_COUNT).fill(one[0]!.key));
    const sameTopic = eligible.filter((g) => g.topicSlug === "fractions");
    const keys = planDaily(sameTopic, 7).map((p) => p.key);
    expect(keys).toHaveLength(DAILY_COUNT);
    expect(new Set(keys).size).toBe(Math.min(sameTopic.length, DAILY_COUNT));
  });

  it("refuses an empty pool", () => {
    expect(() => planDaily([], 1)).toThrow();
  });
});

describe("dailyShareText", () => {
  it("shows right and wrong without giving anything away", () => {
    expect(
      dailyShareText({
        date: "2026-10-04",
        results: [true, true, false, true, false],
        score: 340,
        streak: 3,
      }),
    ).toBe("Past Paper Game daily, Sunday 4 October\n🟩🟩⬜🟩⬜ 3/5\n340 points\n🔥 3-day streak");
  });

  it("leaves out a streak of one day", () => {
    expect(
      dailyShareText({ date: "2026-10-04", results: [false], score: 0, streak: 1 }),
    ).not.toContain("streak");
  });
});
