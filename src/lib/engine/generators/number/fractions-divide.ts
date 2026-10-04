import type { QuestionGenerator } from "../../types";
import { latexFrac, m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

export const fractionsDivide: QuestionGenerator = {
  key: "number.fractions.divide",
  topicSlug: "fractions",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const b = rng.int(2, 10);
      const d = rng.int(2, 10);
      const a = rng.int(1, b - 1);
      const c = rng.int(1, d - 1);
      if (gcd(a, b) !== 1 || gcd(c, d) !== 1) return null;

      const top = a * d;
      const bottom = b * c;
      const g = gcd(top, bottom);
      const num = top / g;
      const den = bottom / g;
      if (den === 1) return null;

      const steps = [
        `Keep the first fraction, change ${m("\\div")} to ${m("\\times")} and flip the second fraction: ` +
          m(`${latexFrac(a, b)} \\times ${latexFrac(d, c)}`),
        `Multiply the numerators and multiply the denominators: ${m(latexFrac(top, bottom))}`,
      ];
      if (g > 1)
        steps.push(
          `Simplify by dividing the numerator and denominator by ${g}: ${m(latexFrac(num, den))}`,
        );
      if (num > den) {
        steps.push(
          `As a mixed number this is ${m(`${Math.floor(num / den)}${latexFrac(num % den, den)}`)}`,
        );
      }

      return {
        promptMd: `Work out ${m(`${latexFrac(a, b)} \\div ${latexFrac(c, d)}`)}.\n\nGive your answer as a fraction in its simplest form.`,
        inputType: "fraction",
        answerSpec: { kind: "fraction", num, den, mustBeSimplest: true, allowMixed: true },
        solution: { steps, final: m(latexFrac(num, den)) },
      };
    });
  },
};
