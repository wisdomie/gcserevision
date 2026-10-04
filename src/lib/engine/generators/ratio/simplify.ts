import type { QuestionGenerator } from "../../types";
import { m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

const UNIT_PAIRS = [
  { small: "cm", large: "m", factor: 100 },
  { small: "g", large: "kg", factor: 1000 },
  { small: "minutes", large: "hours", factor: 60 },
  { small: "p", large: "£", factor: 100 },
] as const;

export const ratioSimplify: QuestionGenerator = {
  key: "ratio.simplify",
  topicSlug: "ratio",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const withUnits = rng.next() < 0.3;
      if (withUnits) {
        const u = rng.pick(UNIT_PAIRS);
        const large = rng.int(1, 5);
        const big = large * u.factor;
        const small = 5 * rng.int(1, big / 5 - 1); // a multiple of 5, less than the larger amount
        const g = gcd(small, big);
        const parts = [small / g, big / g];
        if (g === 1) return null;
        const show = (n: number, unit: string) =>
          unit === "£" ? `£${n}` : unit === "p" ? `${n}p` : `${n} ${unit}`;

        return {
          promptMd: `Write ${show(small, u.small)} : ${show(large, u.large)} as a ratio in its simplest form.`,
          inputType: "expression",
          answerSpec: { kind: "ratio", parts },
          solution: {
            steps: [
              `Write both amounts in the same units: ${show(large, u.large)} = ${show(big, u.small)}`,
              `The ratio is ${m(`${small} : ${big}`)}. Divide both parts by their highest common factor, ${g}.`,
              `${m(`${parts[0]} : ${parts[1]}`)}`,
            ],
            final: m(`${parts[0]} : ${parts[1]}`),
          },
        };
      }

      const n = rng.next() < 0.25 ? 3 : 2;
      const parts = Array.from({ length: n }, () => rng.int(1, 9));
      if (parts.reduce(gcd) !== 1) return null;
      const k = rng.int(2, 12);
      const scaled = parts.map((p) => p * k);

      return {
        promptMd: `Write ${m(scaled.join(" : "))} in its simplest form.`,
        inputType: "expression",
        answerSpec: { kind: "ratio", parts },
        solution: {
          steps: [
            `The highest common factor of ${scaled.join(", ")} is ${k}.`,
            `Divide every part by ${k}: ${m(parts.join(" : "))}`,
          ],
          final: m(parts.join(" : ")),
        },
      };
    });
  },
};
