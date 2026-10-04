import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterGenerators, getGenerator, listGenerators } from "@/lib/engine/generators/registry";
import type { QuestionGenerator } from "@/lib/engine/types";

const all = listGenerators({ includeDiagrams: true });

// Topic slugs seeded in supabase/seed.sql
const seed = readFileSync(join(__dirname, "..", "..", "supabase", "seed.sql"), "utf8");
const seededTopics = new Set(
  [...seed.matchAll(/^\s*\('([a-z0-9-]+)',\s+'/gm)].map((match) => match[1]),
);

describe("generator registry", () => {
  it("has the Phase 1 non-expression generators", () => {
    expect(all.map((g) => g.key).sort()).toEqual(
      [
        "algebra.nth-term",
        "algebra.solve.linear-two-step",
        "algebra.solve.quadratic",
        "algebra.solve.unknown-both-sides",
        "algebra.substitute",
        "number.estimate",
        "number.fractions.add",
        "number.fractions.divide",
        "number.fractions.multiply",
        "number.fractions.of-amount",
        "number.hcf",
        "number.indices.laws",
        "number.lcm",
        "number.percent.change",
        "number.percent.of",
        "number.percent.reverse",
        "number.prime-factors",
        "number.round.dp",
        "number.round.sf",
        "number.standard-form.calc",
        "number.standard-form.convert",
        "probability.single-event",
        "probability.two-events-and",
        "ratio.share",
        "ratio.simplify",
        "ratio.speed-distance-time",
        "stats.mean",
        "stats.mean-from-total",
        "stats.median-range",
      ].sort(),
    );
  });

  it("looks generators up by key", () => {
    expect(getGenerator("number.hcf")?.key).toBe("number.hcf");
    expect(getGenerator("nope")).toBeUndefined();
  });

  it("uses only topic slugs that exist in the seed data", () => {
    expect(seededTopics.size).toBeGreaterThan(40);
    for (const g of all) expect(seededTopics, g.key).toContain(g.topicSlug);
  });

  it("declares valid metadata", () => {
    for (const g of all) {
      expect(g.key).toMatch(/^[a-z]+(\.[a-z0-9-]+)+$/);
      expect(g.tiers.length).toBeGreaterThan(0);
      expect(g.marks).toBeGreaterThan(0);
      expect(g.boards === "all" || g.boards.length > 0).toBe(true);
    }
  });

  describe("listGenerators filters (PLAN.md 5.4)", () => {
    it("by topic", () => {
      expect(
        listGenerators({ topicSlugs: ["hcf-lcm"] })
          .map((g) => g.key)
          .sort(),
      ).toEqual(["number.hcf", "number.lcm"]);
      expect(listGenerators({ topicSlugs: [] })).toHaveLength(all.length);
    });
    it("by tier: Higher-only generators are excluded for Foundation", () => {
      const foundation = listGenerators({ tier: "foundation" }).map((g) => g.key);
      expect(foundation).not.toContain("number.percent.reverse");
      expect(foundation).not.toContain("algebra.solve.quadratic");
      expect(listGenerators({ tier: "higher" })).toHaveLength(all.length);
    });
    it("by board, including mixed-board rooms", () => {
      expect(listGenerators({ board: "aqa" })).toHaveLength(all.length);
      expect(listGenerators({ board: null })).toHaveLength(all.length);
    });
    it("by calculator rule", () => {
      expect(listGenerators({ calculator: "non-calc" })).toHaveLength(all.length);
      expect(listGenerators({ calculator: "calc" })).toHaveLength(all.length);
    });
  });

  describe("filterGenerators with tagged generators", () => {
    const fake = (key: string, over: Partial<QuestionGenerator>): QuestionGenerator => ({
      key,
      topicSlug: "fractions",
      tiers: ["foundation", "higher"],
      calculator: "either",
      marks: 1,
      difficulty: 1,
      boards: "all",
      generate: () => {
        throw new Error("not used");
      },
      ...over,
    });
    const gens = [
      fake("all", {}),
      fake("higher", { tiers: ["higher"] }),
      fake("aqa", { boards: ["aqa"] }),
      fake("calc", { calculator: "calc" }),
      fake("diagram", { needsDiagram: true, topicSlug: "angles" }),
    ];
    const keys = (f: Parameters<typeof filterGenerators>[1]) =>
      filterGenerators(gens, f).map((g) => g.key);

    it("excludes Higher-only for Foundation players", () => {
      expect(keys({ tier: "foundation" })).not.toContain("higher");
      expect(keys({ tier: "higher" })).toContain("higher");
    });
    it("matches board tags; mixed-board rooms take only 'all'", () => {
      expect(keys({ board: "aqa" })).toContain("aqa");
      expect(keys({ board: "ocr" })).not.toContain("aqa");
      expect(keys({ board: null })).not.toContain("aqa");
      expect(keys({})).toContain("aqa");
    });
    it("excludes calculator-only questions from non-calculator sessions", () => {
      expect(keys({ calculator: "non-calc" })).not.toContain("calc");
      expect(keys({ calculator: "calc" })).toContain("calc");
    });
    it("leaves out diagram questions unless asked", () => {
      expect(keys({})).not.toContain("diagram");
      expect(keys({ includeDiagrams: true })).toContain("diagram");
      expect(keys({ includeDiagrams: true, topicSlugs: ["angles"] })).toEqual(["diagram"]);
    });
  });
});
