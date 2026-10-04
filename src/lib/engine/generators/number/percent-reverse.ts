import type { QuestionGenerator } from "../../types";
import { fmt, m } from "../../util/format";

const ITEMS = ["jacket", "games console", "bike", "watch", "tablet", "pair of headphones"] as const;

export const percentReverse: QuestionGenerator = {
  key: "number.percent.reverse",
  topicSlug: "percentages",
  tiers: ["higher"],
  calculator: "either",
  marks: 3,
  difficulty: 4,
  boards: "all",
  generate(rng) {
    const original = 20 * rng.int(2, 30);
    const increase = rng.next() < 0.5;
    const percent = 5 * rng.int(1, increase ? 8 : 9);
    const updated = (original * (100 + (increase ? percent : -percent))) / 100; // whole
    const multiplier = fmt((100 + (increase ? percent : -percent)) / 100);
    const item = rng.pick(ITEMS);

    const prompt = increase
      ? `The price of a ${item} is increased by ${m(`${percent}\\%`)}. The new price is £${updated}.`
      : `In a sale, the price of a ${item} is reduced by ${m(`${percent}\\%`)}. The sale price is £${updated}.`;

    return {
      promptMd: `${prompt}\n\nWork out the original price.`,
      inputType: "numeric",
      answerSpec: { kind: "integer", value: original },
      solution: {
        steps: [
          `The new price is ${m(`${100 + (increase ? percent : -percent)}\\%`)} of the original price, so the multiplier is ${m(multiplier)}.`,
          `Divide by the multiplier to undo the change: ${m(`${updated} \\div ${multiplier} = ${original}`)}`,
          `Check: ${m(`${original} \\times ${multiplier} = ${updated}`)}`,
        ],
        final: `£${original}`,
      },
    };
  },
};
