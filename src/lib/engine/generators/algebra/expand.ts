import type { QuestionGenerator } from "../../types";
import { joinTerms, linear, term } from "../../util/algebra";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

const bracket = (a: number, b: number, v = "x") => `(${linear(a, v, b)})`;

export const expandSingle: QuestionGenerator = {
  key: "algebra.expand.single",
  topicSlug: "expanding-factorising",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const twoBrackets = rng.next() < 0.4;
      const k1 = rng.int(2, 9);
      const a1 = rng.int(1, 5);
      const b1 = rng.int(-9, 9);
      if (b1 === 0) return null;

      if (!twoBrackets) {
        // k(ax + b), or x(ax + b) for a squared term
        const letterOutside = rng.next() < 0.3;
        if (letterOutside) {
          const answer = joinTerms([term(a1, "x^{2}"), term(b1, "x")]);
          return {
            promptMd: `Expand ${m(`x${bracket(a1, b1)}`)}`,
            inputType: "expression",
            answerSpec: { kind: "expression", latex: answer, variables: ["x"], form: "expanded" },
            solution: {
              steps: [
                `Multiply each term in the bracket by ${m("x")}: ${m(`x \\times ${term(a1, "x")} = ${term(a1, "x^{2}")}`)} and ${m(`x \\times ${b1 < 0 ? `(${b1})` : b1} = ${term(b1, "x")}`)}`,
              ],
              final: m(answer),
            },
          };
        }
        const answer = linear(k1 * a1, "x", k1 * b1);
        return {
          promptMd: `Expand ${m(`${k1}${bracket(a1, b1)}`)}`,
          inputType: "expression",
          answerSpec: { kind: "expression", latex: answer, variables: ["x"], form: "expanded" },
          solution: {
            steps: [
              `Multiply each term in the bracket by ${k1}: ${m(`${k1} \\times ${term(a1, "x")} = ${term(k1 * a1, "x")}`)} and ${m(`${k1} \\times ${b1 < 0 ? `(${b1})` : b1} = ${k1 * b1}`)}`,
            ],
            final: m(answer),
          },
        };
      }

      // Expand and simplify k1(a1 x + b1) + k2(a2 x + b2)
      const k2 = rng.int(2, 9) * (rng.next() < 0.3 ? -1 : 1);
      const a2 = rng.int(1, 5);
      const b2 = rng.int(-9, 9);
      const x = k1 * a1 + k2 * a2;
      const c = k1 * b1 + k2 * b2;
      if (b2 === 0 || x === 0 || c === 0) return null;
      const answer = linear(x, "x", c);
      const first = linear(k1 * a1, "x", k1 * b1);
      const second = linear(k2 * a2, "x", k2 * b2);
      const prompt = `${k1}${bracket(a1, b1)} ${k2 < 0 ? "-" : "+"} ${Math.abs(k2)}${bracket(a2, b2)}`;

      return {
        promptMd: `Expand and simplify ${m(prompt)}`,
        inputType: "expression",
        answerSpec: { kind: "expression", latex: answer, variables: ["x"], form: "expanded" },
        solution: {
          steps: [
            `Expand each bracket: ${m(`${k1}${bracket(a1, b1)} = ${first}`)} and ${m(`${k2}${bracket(a2, b2)} = ${second}`)}`,
            `Collect like terms: ${m(`${joinTerms([first, second])} = ${answer}`)}`,
          ],
          final: m(answer),
        },
      };
    });
  },
};

export const expandDouble: QuestionGenerator = {
  key: "algebra.expand.double",
  topicSlug: "expanding-factorising",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      // (p x + a)(q x + b); p = q = 1 most of the time
      const harder = rng.next() < 0.3;
      const p = harder ? rng.int(2, 5) : 1;
      const q = harder ? rng.int(1, 3) : 1;
      const a = rng.int(-9, 9);
      const b = rng.int(-9, 9);
      if (a === 0 || b === 0) return null;
      const square = p * q;
      const middle = p * b + q * a;
      const constant = a * b;
      if (middle === 0) return null;

      const answer = joinTerms([term(square, "x^{2}"), term(middle, "x"), `${constant}`]);
      const grid = [term(p * q, "x^{2}"), term(p * b, "x"), term(q * a, "x"), `${constant}`];

      return {
        promptMd: `Expand and simplify ${m(`${bracket(p, a)}${bracket(q, b)}`)}`,
        inputType: "expression",
        answerSpec: { kind: "expression", latex: answer, variables: ["x"], form: "expanded" },
        solution: {
          steps: [
            `Multiply every term in the first bracket by every term in the second: ${m(joinTerms(grid))}`,
            `Collect the ${m("x")} terms: ${m(`${joinTerms([grid[1], grid[2]])} = ${term(middle, "x")}`)}`,
            `So ${m(`${bracket(p, a)}${bracket(q, b)} = ${answer}`)}`,
          ],
          final: m(answer),
        },
      };
    });
  },
};
