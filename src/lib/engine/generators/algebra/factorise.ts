import type { QuestionGenerator } from "../../types";
import { joinTerms, linear, term } from "../../util/algebra";
import { m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

const bracket = (k: number) => (k === 0 ? "x" : `(x ${k > 0 ? "+" : "-"} ${Math.abs(k)})`);

export const factoriseCommon: QuestionGenerator = {
  key: "algebra.factorise.common",
  topicSlug: "expanding-factorising",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      // HCF outside: k (or kx); inside: a x + b with no common factor left
      const withX = rng.next() < 0.4;
      const k = withX ? rng.int(1, 6) : rng.int(2, 9);
      const a = rng.int(1, 6);
      const b = rng.int(-9, 9);
      if (b === 0 || gcd(a, b) !== 1) return null;

      const outside = withX ? term(k, "x") : `${k}`;
      const inside = linear(a, "x", b);
      const expanded = withX
        ? joinTerms([term(k * a, "x^{2}"), term(k * b, "x")])
        : linear(k * a, "x", k * b);
      const answer = `${outside}(${inside})`;

      return {
        promptMd: `Factorise fully ${m(expanded)}`,
        inputType: "expression",
        answerSpec: { kind: "expression", latex: answer, variables: ["x"], form: "factorised" },
        solution: {
          steps: [
            `The highest common factor of the terms is ${m(outside)}.`,
            `Divide each term by ${m(outside)} to find what goes in the bracket: ${m(inside)}`,
            `So ${m(`${expanded} = ${answer}`)}`,
          ],
          final: m(answer),
        },
      };
    });
  },
};

export const factoriseQuadratic: QuestionGenerator = {
  key: "algebra.factorise.quadratic",
  topicSlug: "quadratics",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const squares = rng.next() < 0.2;
      // (x + p)(x + q)
      const p = squares ? rng.int(2, 12) : rng.int(-9, 9);
      const q = squares ? -p : rng.int(-9, 9);
      if (p === 0 || q === 0 || p < q) return null; // one ordering per pair
      const b = p + q;
      const c = p * q;
      const quadratic = joinTerms(["x^{2}", term(b, "x"), `${c}`]);
      const answer = p === q ? `${bracket(p)}^{2}` : `${bracket(p)}${bracket(q)}`;

      const steps =
        b === 0
          ? [
              `This is a difference of two squares: ${m(`x^{2} - ${p * p} = x^{2} - ${p}^{2}`)}`,
              `${m(`a^{2} - b^{2} = (a + b)(a - b)`)}, so ${m(`${quadratic} = ${answer}`)}`,
            ]
          : [
              `Find two numbers that multiply to ${m(`${c}`)} and add to ${m(`${b}`)}: ${m(`${p}`)} and ${m(`${q}`)}`,
              `So ${m(`${quadratic} = ${answer}`)}`,
            ];

      return {
        promptMd: `Factorise ${m(quadratic)}`,
        inputType: "expression",
        answerSpec: { kind: "expression", latex: answer, variables: ["x"], form: "factorised" },
        solution: { steps, final: m(answer) },
      };
    });
  },
};
