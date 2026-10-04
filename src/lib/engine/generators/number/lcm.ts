import type { QuestionGenerator } from "../../types";
import { factorised, latexPrimeFactors, m } from "../../util/format";
import { lcm } from "../../util/numbers";
import { retry } from "../../util/retry";

export const lowestCommonMultiple: QuestionGenerator = {
  key: "number.lcm",
  topicSlug: "hcf-lcm",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const x = rng.int(4, 30);
      const y = rng.int(4, 30);
      if (x >= y || y % x === 0) return null;
      const l = lcm(x, y);
      if (l > 300) return null;

      return {
        promptMd: `Find the lowest common multiple (LCM) of ${m(`${x}`)} and ${m(`${y}`)}.`,
        inputType: "numeric",
        answerSpec: { kind: "integer", value: l },
        solution: {
          steps: [
            `Write each number as a product of prime factors: ${factorised(x)} and ${factorised(y)}`,
            `Take the highest power of each prime that appears: ${m(`${latexPrimeFactors(l)} = ${l}`)}`,
          ],
          final: `${l}`,
        },
      };
    });
  },
};
