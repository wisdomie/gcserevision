import type { QuestionGenerator } from "../../types";
import { latexFrac, m } from "../../util/format";
import { gcd, lcm } from "../../util/numbers";
import { retry } from "../../util/retry";

export const fractionsAdd: QuestionGenerator = {
  key: "number.fractions.add",
  topicSlug: "fractions",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const b = rng.int(2, 12);
      const d = rng.int(2, 12);
      const a = rng.int(1, b - 1);
      const c = rng.int(1, d - 1);
      const subtract = rng.next() < 0.4;
      if (b === d || gcd(a, b) !== 1 || gcd(c, d) !== 1) return null;

      const common = lcm(b, d);
      if (common > 60) return null;
      const a2 = a * (common / b);
      const c2 = c * (common / d);
      if (subtract && a2 <= c2) return null;

      const total = subtract ? a2 - c2 : a2 + c2;
      const g = gcd(total, common);
      const num = total / g;
      const den = common / g;
      if (den === 1) return null;

      const op = subtract ? "-" : "+";
      const conversions = [
        ...(b !== common ? [m(`${latexFrac(a, b)} = ${latexFrac(a2, common)}`)] : []),
        ...(d !== common ? [m(`${latexFrac(c, d)} = ${latexFrac(c2, common)}`)] : []),
      ];
      const steps = [
        `Write both fractions with a common denominator of ${common}: ${conversions.join(" and ")}`,
        `${subtract ? "Subtract" : "Add"} the numerators: ` +
          m(
            `${latexFrac(a2, common)} ${op} ${latexFrac(c2, common)} = ${latexFrac(total, common)}`,
          ),
      ];
      if (g > 1) {
        steps.push(
          `Simplify by dividing the numerator and denominator by ${g}: ${m(latexFrac(num, den))}`,
        );
      }
      if (num > den) {
        steps.push(
          `As a mixed number this is ${m(`${Math.floor(num / den)}${latexFrac(num % den, den)}`)}`,
        );
      }

      return {
        promptMd: `Work out ${m(`${latexFrac(a, b)} ${op} ${latexFrac(c, d)}`)}.\n\nGive your answer as a fraction in its simplest form.`,
        inputType: "fraction",
        answerSpec: { kind: "fraction", num, den, mustBeSimplest: true, allowMixed: true },
        solution: { steps, final: m(latexFrac(num, den)) },
      };
    });
  },
};
