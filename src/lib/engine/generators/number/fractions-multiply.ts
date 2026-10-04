import type { QuestionGenerator } from "../../types";
import { latexFrac, m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

/** A fraction in lowest terms, keyed for comparing values. */
function reduce(num: number, den: number) {
  const g = gcd(num, den);
  return { num: num / g, den: den / g, key: `${num / g}/${den / g}` };
}

const show = (f: { num: number; den: number }) =>
  m(f.den === 1 ? `${f.num}` : latexFrac(f.num, f.den));

export const fractionsMultiply: QuestionGenerator = {
  key: "number.fractions.multiply",
  topicSlug: "fractions",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const b = rng.int(2, 10);
      const d = rng.int(2, 10);
      const a = rng.int(1, b - 1);
      const c = rng.int(1, d - 1);
      if (gcd(a, b) !== 1 || gcd(c, d) !== 1) return null;

      const product = { num: a * c, den: b * d };
      const correct = reduce(product.num, product.den);
      if (correct.den === 1) return null;

      // Distractors from common mistakes
      const mistakes = rng.shuffle([
        reduce(a * d, b * c), // multiplied across the diagonal (divided instead)
        reduce(a + c, b + d), // added numerators and denominators
        reduce(a * d + b * c, b * d), // added the fractions instead
        reduce(a * c, b + d), // multiplied tops, added bottoms
        reduce(a + c, b * d), // added tops, multiplied bottoms
      ]);
      const seen = new Set([correct.key]);
      const distractors = mistakes.filter((f) => !seen.has(f.key) && seen.add(f.key)).slice(0, 3);
      if (distractors.length < 3) return null;

      const options = rng.shuffle([correct, ...distractors]);
      const correctIndex = options.indexOf(correct);

      const steps = [
        `Multiply the numerators and multiply the denominators: ` +
          m(
            `${latexFrac(a, b)} \\times ${latexFrac(c, d)} = ${latexFrac(product.num, product.den)}`,
          ),
      ];
      if (correct.num !== product.num) {
        steps.push(
          `Simplify by dividing the numerator and denominator by ${product.num / correct.num}: ${show(correct)}`,
        );
      }

      return {
        promptMd: `Work out ${m(`${latexFrac(a, b)} \\times ${latexFrac(c, d)}`)}.\n\nChoose the answer in its simplest form.`,
        inputType: "mcq",
        options: options.map(show),
        answerSpec: { kind: "mcq", correctIndex },
        solution: { steps, final: show(correct) },
      };
    });
  },
};
