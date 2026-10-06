// Property tests for every registered generator (PLAN.md 6.4 and 12.2).
import { describe, expect, it } from "vitest";
import { check } from "@/lib/engine/answers/check";
import { DiagramSchema, type Diagram } from "@/lib/engine/diagram";
import { normalise } from "@/lib/engine/answers/normalise";
import { listGenerators } from "@/lib/engine/generators/registry";
import { createRng } from "@/lib/engine/rng";
import {
  AnswerSpecSchema,
  INPUT_TYPE_FOR_KIND,
  type AnswerSpec,
  type GeneratedQuestion,
  type QuestionGenerator,
} from "@/lib/engine/types";

const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);

/** Generators whose answers may legitimately be negative. */
const NEGATIVE_ANSWERS_OK = new Set<string>([
  "algebra.solve.linear-two-step",
  "algebra.solve.unknown-both-sides",
  "algebra.solve.quadratic",
  "algebra.substitute",
  "algebra.straight-line.gradient",
]);

const BAD_TEXT = [
  /NaN/,
  /undefined/,
  /Infinity/,
  /\bnull\b/,
  /\[object Object\]/,
  /(^|[^\d.])-0(?![\d.])/,
  /,;/, // a LaTeX "\;" that lost its backslash
];

function diagramTexts(d: Diagram): string[] {
  switch (d.kind) {
    case "geometry":
      return [d.alt, ...d.labels.map((l) => l.text)];
    case "graph":
      return [d.alt, d.x.label ?? "", d.y.label ?? "", ...d.lines.map((l) => l.label ?? "")];
    case "bar":
      return [d.alt, ...d.categories, d.xLabel ?? "", d.y.label ?? ""];
  }
}

function texts(q: GeneratedQuestion): string[] {
  return [
    q.promptMd,
    ...q.solution.steps,
    q.solution.final,
    ...(q.options ?? []),
    ...(q.diagram ? diagramTexts(q.diagram) : []),
  ];
}

/** Every number an answer spec contains. */
function specNumbers(spec: AnswerSpec): number[] {
  switch (spec.kind) {
    case "mcq":
      return [spec.correctIndex];
    case "integer":
    case "decimal":
    case "percentage":
      return [spec.value];
    case "fraction":
      return [spec.num, spec.den];
    case "solutions":
      return spec.values;
    case "ratio":
      return spec.parts;
    case "standardForm":
      return [spec.mantissa];
    case "multi":
      return spec.parts.flatMap((p) => specNumbers(p.spec));
    case "expression":
    case "keywords":
      return [];
  }
}

const unescapedDollars = (s: string) => (s.replace(/\\\$/g, "").match(/\$/g) ?? []).length;

describe.each(listGenerators({ includeDiagrams: true }).map((g) => [g.key, g] as const))(
  "%s",
  (_key, gen: QuestionGenerator) => {
    const questions = SEEDS.map((seed) => ({ seed, q: gen.generate(createRng(seed)) }));

    it("is deterministic for a seed", () => {
      for (const { seed, q } of questions) {
        expect(gen.generate(createRng(seed)), `seed ${seed}`).toEqual(q);
      }
    });

    it("has a valid AnswerSpec whose kind matches the input type", () => {
      for (const { seed, q } of questions) {
        const parsed = AnswerSpecSchema.safeParse(q.answerSpec);
        expect(parsed.success, `seed ${seed}: ${parsed.error?.message}`).toBe(true);
        expect(INPUT_TYPE_FOR_KIND[q.answerSpec.kind], `seed ${seed}`).toBe(q.inputType);
      }
    });

    it("has a final answer that passes the checker", () => {
      for (const { seed, q } of questions) {
        const raw =
          q.answerSpec.kind === "mcq" ? String(q.answerSpec.correctIndex) : q.solution.final;
        const result = check(q.answerSpec, raw, gen.marks);
        expect(result, `seed ${seed}: ${q.solution.final}`).toEqual({
          correct: true,
          marksAwarded: gen.marks,
        });
        if (q.answerSpec.kind === "mcq") {
          expect(q.options?.[q.answerSpec.correctIndex], `seed ${seed}`).toBe(q.solution.final);
        }
      }
    });

    it("has 4 unique MCQ options with exactly one correct (or no options otherwise)", () => {
      for (const { seed, q } of questions) {
        if (q.inputType !== "mcq") {
          expect(q.options, `seed ${seed}`).toBeUndefined();
          continue;
        }
        const options = q.options ?? [];
        expect(options, `seed ${seed}`).toHaveLength(4);
        expect(new Set(options.map(normalise)).size, `seed ${seed}`).toBe(4);
        expect(
          options.filter((o) => normalise(o) === normalise(q.solution.final)),
          `seed ${seed}`,
        ).toHaveLength(1);
      }
    });

    it("has clean text: no NaN, undefined, Infinity or -0, and balanced $ delimiters", () => {
      for (const { seed, q } of questions) {
        expect(q.promptMd.trim().length, `seed ${seed}`).toBeGreaterThan(0);
        expect(q.solution.steps.length, `seed ${seed}`).toBeGreaterThan(0);
        for (const text of texts(q)) {
          for (const bad of BAD_TEXT) expect(text, `seed ${seed}`).not.toMatch(bad);
          expect(unescapedDollars(text) % 2, `seed ${seed}: ${text}`).toBe(0);
        }
      }
    });

    it("has answers within sane bounds", () => {
      for (const { seed, q } of questions) {
        for (const x of specNumbers(q.answerSpec)) {
          expect(Number.isFinite(x), `seed ${seed}`).toBe(true);
          expect(Math.abs(x), `seed ${seed}`).toBeLessThan(1e6);
          if (!NEGATIVE_ANSWERS_OK.has(gen.key))
            expect(x, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it(gen.needsDiagram ? "has a valid diagram" : "has no diagram", () => {
      for (const { seed, q } of questions) {
        if (!gen.needsDiagram) {
          expect(q.diagram, `seed ${seed}`).toBeUndefined();
          continue;
        }
        const parsed = DiagramSchema.safeParse(q.diagram);
        expect(parsed.success, `seed ${seed}: ${parsed.error?.message}`).toBe(true);
        if (q.diagram?.kind === "geometry" && q.promptMd.includes("marked")) {
          // The unknown is marked, and no label is the answer itself
          expect(
            q.diagram.labels.some((l) => l.text === "x"),
            `seed ${seed}`,
          ).toBe(true);
          const final = q.solution.final.replace(/\s.*$/, "");
          for (const l of q.diagram.labels)
            expect(l.text.replace(/\s.*$/, ""), `seed ${seed}`).not.toBe(final);
        }
      }
    });

    it("varies across seeds", () => {
      const prompts = new Set(
        questions.map(({ q }) => q.promptMd + JSON.stringify(q.diagram ?? null)),
      );
      expect(prompts.size).toBeGreaterThan(SEEDS.length / 10);
    });
  },
);
