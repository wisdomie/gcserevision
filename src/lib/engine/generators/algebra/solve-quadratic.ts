import type { QuestionGenerator } from "../../types";
import { joinTerms, term } from "../../util/algebra";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

/** (x + k) as LaTeX, or x when k = 0. */
const bracket = (k: number) => (k === 0 ? "x" : `(x ${k > 0 ? "+" : "-"} ${Math.abs(k)})`);

export const solveQuadratic: QuestionGenerator = {
  key: "algebra.solve.quadratic",
  topicSlug: "quadratics",
  tiers: ["higher"],
  calculator: "non-calc",
  marks: 3,
  difficulty: 4,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const r1 = rng.int(-9, 9);
      const r2 = rng.int(-9, 9);
      if (r1 === r2 || r1 > r2) return null; // distinct roots, one ordering per pair

      // (x - r1)(x - r2) = x^2 - (r1 + r2)x + r1 r2
      const b = -(r1 + r2);
      const c = r1 * r2;
      const quadratic = joinTerms(["x^{2}", term(b, "x"), c === 0 ? "" : `${c}`]);
      const factorised =
        r1 === 0 || r2 === 0
          ? `x${bracket(r1 === 0 ? -r2 : -r1)}`
          : `${bracket(-r1)}${bracket(-r2)}`;

      const steps =
        c === 0
          ? [`Take out the common factor ${m("x")}: ${m(`${factorised} = 0`)}`]
          : [
              `Find two numbers that multiply to ${m(`${c}`)} and add to ${m(`${b}`)}: ${m(`${-r1}`)} and ${m(`${-r2}`)}`,
              `Factorise: ${m(`${factorised} = 0`)}`,
            ];
      steps.push(`Set each factor equal to zero: ${m(`x = ${r1}`)} or ${m(`x = ${r2}`)}`);

      return {
        promptMd: `Solve ${m(`${quadratic} = 0`)}`,
        inputType: "expression",
        answerSpec: { kind: "solutions", variable: "x", values: [r1, r2] },
        solution: { steps, final: `${m(`x = ${r1}`)} or ${m(`x = ${r2}`)}` },
      };
    });
  },
};
