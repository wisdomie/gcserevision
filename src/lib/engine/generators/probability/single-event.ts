import type { QuestionGenerator } from "../../types";
import { latexFrac, m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

const COLOURS = ["red", "blue", "green", "yellow", "purple"] as const;
const CONTAINERS = [
  { holder: "A bag", item: "counter" },
  { holder: "A box", item: "ball" },
  { holder: "A jar", item: "sweet" },
] as const;

export const probabilitySingleEvent: QuestionGenerator = {
  key: "probability.single-event",
  topicSlug: "basic-probability",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 1,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const colours = rng.shuffle(COLOURS).slice(0, rng.int(2, 4));
      const counts = colours.map(() => rng.int(1, 12));
      const total = counts.reduce((a, b) => a + b, 0);
      if (total > 30) return null;
      const target = rng.int(0, colours.length - 1);
      const not = rng.next() < 0.3;
      const favourable = not ? total - counts[target] : counts[target];
      if (favourable === 0 || favourable === total) return null;
      const { holder, item } = rng.pick(CONTAINERS);

      const g = gcd(favourable, total);
      const listing = colours.map((c, i) => `${counts[i]} ${c}`);
      const list = `${listing.slice(0, -1).join(", ")} and ${listing.at(-1)}`;
      const event = not ? `not ${colours[target]}` : colours[target];
      const steps = [
        `There are ${m(`${counts.join(" + ")} = ${total}`)} ${item}s altogether.`,
        not
          ? `${favourable} of them are not ${colours[target]}, so the probability is ${m(latexFrac(favourable, total))}`
          : `${favourable} of them are ${colours[target]}, so the probability is ${m(latexFrac(favourable, total))}`,
      ];
      if (g > 1) steps.push(`This simplifies to ${m(latexFrac(favourable / g, total / g))}`);

      return {
        promptMd: `${holder} contains ${list} ${item}s. One ${item} is taken at random.\n\nWork out the probability that it is ${event}.`,
        inputType: "fraction",
        // Unsimplified probabilities are fine at GCSE
        answerSpec: {
          kind: "fraction",
          num: favourable / g,
          den: total / g,
          mustBeSimplest: false,
        },
        solution: { steps, final: m(latexFrac(favourable / g, total / g)) },
      };
    });
  },
};
