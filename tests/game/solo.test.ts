import { describe, expect, it } from "vitest";
import { listGenerators } from "@/lib/engine/generators/registry";
import { createRng } from "@/lib/engine/rng";
import {
  currentStreak,
  planSoloSession,
  SoloAnswerSchema,
  SoloStartSchema,
  summariseByTopic,
  toPublicQuestion,
} from "@/lib/game/solo";

const algebra = listGenerators({ tier: "higher", board: "aqa" }).filter((g) =>
  g.key.startsWith("algebra."),
);

describe("planSoloSession", () => {
  it("returns the requested number of questions from the eligible generators", () => {
    const plan = planSoloSession(algebra, 10, "higher", 123);
    expect(plan).toHaveLength(10);
    const keys = new Set(algebra.map((g) => g.key));
    for (const q of plan) {
      expect(keys).toContain(q.key);
      expect(Number.isInteger(q.seed)).toBe(true);
    }
  });

  it("is deterministic for a seed", () => {
    expect(planSoloSession(algebra, 20, "higher", 7)).toEqual(
      planSoloSession(algebra, 20, "higher", 7),
    );
    expect(planSoloSession(algebra, 20, "higher", 7)).not.toEqual(
      planSoloSession(algebra, 20, "higher", 8),
    );
  });

  it("never repeats a generator back to back when there is a choice", () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = planSoloSession(algebra, 20, "foundation", seed);
      for (let i = 1; i < plan.length; i++) expect(plan[i].key).not.toBe(plan[i - 1].key);
    }
  });

  it("repeats the only generator when there is no choice", () => {
    const plan = planSoloSession([algebra[0]], 3, "higher", 1);
    expect(plan.map((q) => q.key)).toEqual([algebra[0].key, algebra[0].key, algebra[0].key]);
    expect(new Set(plan.map((q) => q.seed)).size).toBe(3);
  });

  it("weights Higher sessions towards harder generators", () => {
    const all = listGenerators({ tier: "higher" });
    const meanDifficulty = (tier: "foundation" | "higher") => {
      let total = 0;
      let n = 0;
      for (let seed = 0; seed < 40; seed++) {
        for (const q of planSoloSession(all, 20, tier, seed)) {
          total += all.find((g) => g.key === q.key)!.difficulty;
          n++;
        }
      }
      return total / n;
    };
    expect(meanDifficulty("higher")).toBeGreaterThan(meanDifficulty("foundation") + 0.2);
  });

  it("rejects an empty pool", () => {
    expect(() => planSoloSession([], 5, "higher", 1)).toThrow();
  });
});

describe("currentStreak", () => {
  it("counts correct answers from the newest until the first wrong one", () => {
    expect(currentStreak([])).toBe(0);
    expect(currentStreak([true, true, false, true])).toBe(2);
    expect(currentStreak([false, true])).toBe(0);
    expect(currentStreak([true, true, true])).toBe(3);
  });
});

describe("toPublicQuestion", () => {
  it("never includes the answer spec or solution", () => {
    for (const gen of listGenerators()) {
      const q = gen.generate(createRng(5));
      const pub = toPublicQuestion("id-1", q, gen, "Topic");
      const json = JSON.stringify(pub);
      expect(json).not.toContain("answerSpec");
      expect(json).not.toContain("solution");
      expect(json).not.toContain(q.solution.steps[0]);
      expect(Object.keys(pub).sort()).toEqual(
        [
          "calculator",
          "inputType",
          "instanceId",
          "marks",
          "promptMd",
          "topicName",
          ...(q.options ? ["options"] : []),
        ].sort(),
      );
    }
  });
});

describe("summariseByTopic", () => {
  it("totals attempts and correct answers per topic in first-seen order", () => {
    expect(
      summariseByTopic([
        { topicName: "Fractions", correct: true },
        { topicName: "Ratio", correct: false },
        { topicName: "Fractions", correct: false },
      ]),
    ).toEqual([
      { topicName: "Fractions", attempted: 2, correct: 1 },
      { topicName: "Ratio", attempted: 1, correct: 0 },
    ]);
  });
});

describe("input schemas", () => {
  it("validates start settings", () => {
    expect(
      SoloStartSchema.safeParse({ topicSlugs: ["fractions"], count: 10, timed: false }).success,
    ).toBe(true);
    expect(SoloStartSchema.safeParse({ topicSlugs: [], count: 7, timed: false }).success).toBe(
      false,
    );
    expect(
      SoloStartSchema.safeParse({ topicSlugs: ["DROP TABLE"], count: 5, timed: false }).success,
    ).toBe(false);
  });
  it("caps raw answers at 200 characters", () => {
    const base = { sessionId: crypto.randomUUID(), instanceId: crypto.randomUUID() };
    expect(SoloAnswerSchema.safeParse({ ...base, raw: "x".repeat(200) }).success).toBe(true);
    expect(SoloAnswerSchema.safeParse({ ...base, raw: "x".repeat(201) }).success).toBe(false);
    expect(SoloAnswerSchema.safeParse({ ...base, sessionId: "nope", raw: "1" }).success).toBe(
      false,
    );
  });
});
