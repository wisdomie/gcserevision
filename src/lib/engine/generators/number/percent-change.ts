import type { QuestionGenerator } from "../../types";
import { latexFrac, m } from "../../util/format";

const ITEMS = ["bike", "phone", "coat", "laptop", "concert ticket", "pair of trainers"] as const;

export const percentChange: QuestionGenerator = {
  key: "number.percent.change",
  topicSlug: "percentage-change",
  tiers: ["foundation", "higher"],
  calculator: "either",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    const original = 20 * rng.int(1, 25);
    const increase = rng.next() < 0.5;
    const percent = 5 * rng.int(1, increase ? 12 : 10);
    const change = (original * percent) / 100; // always whole
    const updated = increase ? original + change : original - change;
    const item = rng.pick(ITEMS);
    const word = increase ? "increase" : "decrease";

    return {
      promptMd:
        `The price of a ${item} ${word}s from £${original} to £${updated}.\n\n` +
        `Work out the percentage ${word}.`,
      inputType: "numeric",
      answerSpec: { kind: "percentage", value: percent },
      solution: {
        steps: [
          `Find the actual ${word}: ${m(increase ? `${updated} - ${original} = ${change}` : `${original} - ${updated} = ${change}`)}`,
          `Divide by the original price and multiply by 100: ${m(`${latexFrac(change, original)} \\times 100 = ${percent}`)}`,
        ],
        final: `${percent}%`,
      },
    };
  },
};
