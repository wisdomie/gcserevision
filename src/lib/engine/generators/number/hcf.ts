import type { QuestionGenerator } from "../../types";
import { factorised, latexPrimeFactors, m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

export const highestCommonFactor: QuestionGenerator = {
  key: "number.hcf",
  topicSlug: "hcf-lcm",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const h = rng.int(2, 15);
      const a = rng.int(2, 12);
      const b = rng.int(2, 12);
      if (a >= b || gcd(a, b) !== 1 || h * b > 200) return null;
      const x = h * a;
      const y = h * b;

      const hFactors = latexPrimeFactors(h);
      return {
        promptMd: `Find the highest common factor (HCF) of ${m(`${x}`)} and ${m(`${y}`)}.`,
        inputType: "numeric",
        answerSpec: { kind: "integer", value: h },
        solution: {
          steps: [
            `Write each number as a product of prime factors: ${factorised(x)} and ${factorised(y)}`,
            hFactors === `${h}`
              ? `The only prime factor they have in common is ${m(`${h}`)}.`
              : `Multiply the prime factors they have in common: ${m(`${hFactors} = ${h}`)}`,
          ],
          final: `${h}`,
        },
      };
    });
  },
};
