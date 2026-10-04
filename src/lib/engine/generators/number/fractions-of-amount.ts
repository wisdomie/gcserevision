import type { AnswerSpec, QuestionGenerator } from "../../types";
import { latexFrac, m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

type Context = { show: (x: number) => string; spec: (x: number) => AnswerSpec };

const CONTEXTS: Context[] = [
  { show: (x) => `£${x}`, spec: (x) => ({ kind: "integer", value: x }) },
  { show: (x) => `${x} kg`, spec: (x) => ({ kind: "decimal", value: x, unit: "kg" }) },
  { show: (x) => `${x} ml`, spec: (x) => ({ kind: "decimal", value: x, unit: "ml" }) },
  { show: (x) => `${x}`, spec: (x) => ({ kind: "integer", value: x }) },
];

export const fractionsOfAmount: QuestionGenerator = {
  key: "number.fractions.of-amount",
  topicSlug: "fractions",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 1,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const b = rng.int(3, 12);
      const a = rng.int(1, b - 1);
      if (gcd(a, b) !== 1) return null;
      const part = rng.int(2, 40);
      const amount = b * part;
      if (amount > 500) return null;
      const answer = a * part;
      const ctx = rng.pick(CONTEXTS);

      const steps = [
        `Divide by the denominator to find ${m(latexFrac(1, b))}: ${m(`${amount} \\div ${b} = ${part}`)}`,
      ];
      if (a > 1) steps.push(`Multiply by the numerator: ${m(`${part} \\times ${a} = ${answer}`)}`);

      return {
        promptMd: `Work out ${m(latexFrac(a, b))} of ${ctx.show(amount)}.`,
        inputType: "numeric",
        answerSpec: ctx.spec(answer),
        solution: { steps, final: ctx.show(answer) },
      };
    });
  },
};
