import { describe, expect, it } from "vitest";
import { listGenerators } from "@/lib/engine/generators/registry";
import { createRng } from "@/lib/engine/rng";
import { bankGenerator, isBankKey, planWithBank, type BankRow } from "@/lib/game/bank";
import { planSoloSession } from "@/lib/game/solo";

const row = (id: string, topicSlug: string, over: Partial<BankRow> = {}): BankRow => ({
  id,
  slug: id,
  subjectSlug: "maths",
  topicSlug,
  tier: "both",
  calculator: "non-calc",
  boards: "all",
  difficulty: 2,
  marks: 2,
  inputType: "numeric",
  promptMd: `Question ${id}`,
  options: null,
  answerSpec: { kind: "integer", value: 1 },
  solution: { steps: ["step"], final: "1" },
  ...over,
});

describe("bankGenerator", () => {
  it("serves the stored question whatever the seed", () => {
    const gen = bankGenerator(row("q1", "fractions", { tier: "higher", boards: ["aqa"] }));
    expect(gen.key).toBe("bank:q1");
    expect(isBankKey(gen.key)).toBe(true);
    expect(gen.tiers).toEqual(["higher"]);
    expect(gen.boards).toEqual(["aqa"]);
    expect(gen.generate(createRng(1))).toEqual(gen.generate(createRng(2)));
    expect(gen.generate(createRng(1))).not.toHaveProperty("options");
  });
});

describe("planWithBank", () => {
  const generators = listGenerators({ topicSlugs: ["fractions", "ratio"] });
  const bank = Array.from({ length: 30 }, (_, i) =>
    bankGenerator(row(`b${i}`, i % 2 ? "fractions" : "ratio")),
  );
  const plan = (seed: number, count = 20) =>
    planWithBank(
      (pool, s) => planSoloSession(pool, count, "foundation", s),
      generators,
      bank,
      seed,
    );

  it("mixes bank questions in without letting them take over", () => {
    let bankPicks = 0;
    let total = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const p = plan(seed);
      total += p.length;
      bankPicks += p.filter((q) => isBankKey(q.key)).length;
      // Every key is a real generator or a real bank question
      for (const q of p)
        expect(
          [...generators, ...bank].some((g) => g.key === q.key),
          q.key,
        ).toBe(true);
    }
    // 2 bank stand-ins among the generators of 2 topics
    expect(bankPicks / total).toBeGreaterThan(0.1);
    expect(bankPicks / total).toBeLessThan(0.4);
  });

  it("doesn't repeat a bank question in a session while there are unused ones", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const keys = plan(seed)
        .filter((q) => isBankKey(q.key))
        .map((q) => q.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("is deterministic and works with only bank questions", () => {
    expect(plan(7)).toEqual(plan(7));
    const onlyBank = planWithBank((pool, s) => planSoloSession(pool, 5, "higher", s), [], bank, 3);
    expect(onlyBank.every((q) => isBankKey(q.key))).toBe(true);
  });
});
