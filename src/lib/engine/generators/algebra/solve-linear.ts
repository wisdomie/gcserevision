import type { QuestionGenerator } from "../../types";
import { joinTerms, linear, signed, term } from "../../util/algebra";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

const VARIABLES = ["x", "x", "x", "y", "n", "a"] as const;

export const solveLinearTwoStep: QuestionGenerator = {
  key: "algebra.solve.linear-two-step",
  topicSlug: "linear-equations",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const v = rng.pick(VARIABLES);
      const x = rng.int(-6, 12);
      const a = rng.int(2, 9);
      const b = rng.int(-20, 20);
      if (b === 0 || x === 0) return null;
      const divided = rng.next() < 0.25;

      // ax + b = c, or x/a + b = c (then x is a multiple of a)
      const value = divided ? x * a : x;
      const c = divided ? x + b : a * x + b;
      const lhs = divided ? joinTerms([`\\frac{${v}}{${a}}`, `${b}`]) : linear(a, v, b);

      const steps = [
        `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} ${b > 0 ? "from" : "to"} both sides: ` +
          m(`${divided ? `\\frac{${v}}{${a}}` : term(a, v)} = ${c} ${signed(-b)} = ${c - b}`),
        divided
          ? `Multiply both sides by ${a}: ${m(`${v} = ${c - b} \\times ${a} = ${value}`)}`
          : `Divide both sides by ${a}: ${m(`${v} = \\frac{${c - b}}{${a}} = ${value}`)}`,
      ];

      return {
        promptMd: `Solve ${m(`${lhs} = ${c}`)}`,
        inputType: "expression",
        answerSpec: { kind: "solutions", variable: v, values: [value] },
        solution: { steps, final: m(`${v} = ${value}`) },
      };
    });
  },
};

export const solveUnknownBothSides: QuestionGenerator = {
  key: "algebra.solve.unknown-both-sides",
  topicSlug: "linear-equations",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 3,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const v = rng.pick(VARIABLES);
      const x = rng.int(-8, 12);
      const c = rng.int(1, 7);
      const a = c + rng.int(1, 6);
      const b = rng.int(-15, 15);
      const d = (a - c) * x + b;
      if (x === 0 || b === d || b === 0) return null;

      const diff = a - c;
      const steps = [
        `Subtract ${m(term(c, v))} from both sides: ${m(`${linear(diff, v, b)} = ${d}`)}`,
        `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} ${b > 0 ? "from" : "to"} both sides: ${m(`${term(diff, v)} = ${d - b}`)}`,
      ];
      if (diff !== 1) steps.push(`Divide both sides by ${diff}: ${m(`${v} = ${x}`)}`);

      return {
        promptMd: `Solve ${m(`${linear(a, v, b)} = ${linear(c, v, d)}`)}`,
        inputType: "expression",
        answerSpec: { kind: "solutions", variable: v, values: [x] },
        solution: { steps, final: m(`${v} = ${x}`) },
      };
    });
  },
};
