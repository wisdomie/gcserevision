import type { QuestionGenerator } from "../../types";
import { joinTerms, term } from "../../util/algebra";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

const LETTER_PAIRS = [
  ["a", "b"],
  ["x", "y"],
  ["m", "n"],
  ["p", "q"],
  ["c", "d"],
] as const;

export const simplifyExpression: QuestionGenerator = {
  key: "algebra.simplify",
  topicSlug: "simplifying",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 1,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const [u, v] = rng.pick(LETTER_PAIRS);
      // Two terms in each letter, the second of each possibly subtracted
      const a1 = rng.int(1, 9);
      const a2 = rng.int(1, 9) * (rng.next() < 0.4 ? -1 : 1);
      const b1 = rng.int(1, 9);
      const b2 = rng.int(1, 9) * (rng.next() < 0.4 ? -1 : 1);
      const a = a1 + a2;
      const b = b1 + b2;
      if (a === 0 || b === 0) return null;

      const terms = rng.shuffle([
        { coef: a1, letter: u },
        { coef: a2, letter: u },
        { coef: b1, letter: v },
        { coef: b2, letter: v },
      ]);
      if (terms[0].coef < 0) return null; // start with a positive term, as textbooks do
      const prompt = joinTerms(terms.map((t) => term(t.coef, t.letter)));
      const answer = joinTerms([term(a, u), term(b, v)]);

      return {
        promptMd: `Simplify ${m(prompt)}`,
        inputType: "expression",
        answerSpec: { kind: "expression", latex: answer, variables: [u, v], form: "simplified" },
        solution: {
          steps: [
            `Collect the ${m(u)} terms: ${m(`${joinTerms([term(a1, u), term(a2, u)])} = ${term(a, u)}`)}`,
            `Collect the ${m(v)} terms: ${m(`${joinTerms([term(b1, v), term(b2, v)])} = ${term(b, v)}`)}`,
          ],
          final: m(answer),
        },
      };
    });
  },
};
