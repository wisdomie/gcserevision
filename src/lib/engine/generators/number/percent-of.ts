import type { AnswerSpec, QuestionGenerator } from "../../types";
import { m } from "../../util/format";

const PERCENTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90] as const;

type Context = { show: (x: number) => string; spec: (x: number) => AnswerSpec };

const CONTEXTS: Context[] = [
  { show: (x) => `£${x}`, spec: (x) => ({ kind: "integer", value: x }) },
  { show: (x) => `${x} kg`, spec: (x) => ({ kind: "decimal", value: x, unit: "kg" }) },
  { show: (x) => `${x} m`, spec: (x) => ({ kind: "decimal", value: x, unit: "m" }) },
  { show: (x) => `${x}`, spec: (x) => ({ kind: "integer", value: x }) },
];

export const percentOf: QuestionGenerator = {
  key: "number.percent.of",
  topicSlug: "percentages",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    const p = rng.pick(PERCENTS);
    const amount = 20 * rng.int(1, 49);
    const ctx = rng.pick(CONTEXTS);
    const answer = (p * amount) / 100; // amount is a multiple of 20, p of 5: always whole

    // Non-calculator method: build p% from 10% and 5%
    const tens = Math.floor(p / 10);
    const hasFive = p % 10 === 5;
    const ten = amount / 10;
    const steps = [`Find ${m("10\\%")} by dividing by 10: ${m(`${amount} \\div 10 = ${ten}`)}`];
    if (hasFive)
      steps.push(`Find ${m("5\\%")} by halving ${m("10\\%")}: ${m(`${ten} \\div 2 = ${ten / 2}`)}`);
    const parts = [
      ...(tens ? [tens === 1 ? `${ten}` : `${tens} \\times ${ten}`] : []),
      ...(hasFive ? [`${ten / 2}`] : []),
    ];
    if (parts.length > 1 || tens > 1) {
      steps.push(m(`${p}\\% = ${parts.join(" + ")} = ${answer}`));
    }

    return {
      promptMd: `Work out ${m(`${p}\\%`)} of ${ctx.show(amount)}.`,
      inputType: "numeric",
      answerSpec: ctx.spec(answer),
      solution: { steps, final: ctx.show(answer) },
    };
  },
};
