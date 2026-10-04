import type { QuestionGenerator } from "../../types";
import { latexFrac, m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

interface Event {
  text: string;
  num: number;
  den: number;
}

const DICE: Event[] = [
  { text: "a 6 on the dice", num: 1, den: 6 },
  { text: "an even number on the dice", num: 3, den: 6 },
  { text: "a number greater than 4 on the dice", num: 2, den: 6 },
  { text: "a square number on the dice", num: 2, den: 6 },
  { text: "a prime number on the dice", num: 3, den: 6 },
  { text: "a number less than 3 on the dice", num: 2, den: 6 },
  { text: "a 1 or a 2 on the dice", num: 2, den: 6 },
];
const COIN: Event[] = [
  { text: "heads on the coin", num: 1, den: 2 },
  { text: "tails on the coin", num: 1, den: 2 },
];
const SPINNER: Event[] = [
  { text: "a 1 on the spinner", num: 1, den: 4 },
  { text: "an odd number on the spinner", num: 2, den: 4 },
  { text: "a number less than 4 on the spinner", num: 3, den: 4 },
  { text: "a 4 on the spinner", num: 1, den: 4 },
  { text: "an even number on the spinner", num: 2, den: 4 },
];

const PAIRS = [
  { setup: "A fair six-sided dice is rolled and a fair coin is flipped.", a: DICE, b: COIN },
  {
    setup: "A fair coin is flipped and a fair four-sided spinner numbered 1 to 4 is spun.",
    a: COIN,
    b: SPINNER,
  },
  {
    setup: "A fair six-sided dice is rolled and a fair four-sided spinner numbered 1 to 4 is spun.",
    a: DICE,
    b: SPINNER,
  },
] as const;

export const probabilityTwoEventsAnd: QuestionGenerator = {
  key: "probability.two-events-and",
  topicSlug: "basic-probability",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const pair = rng.pick(PAIRS);
      const a = rng.pick(pair.a);
      const b = rng.pick(pair.b);
      const num = a.num * b.num;
      const den = a.den * b.den;
      const g = gcd(num, den);
      if (den / g === 1) return null;

      const pa = latexFrac(a.num, a.den);
      const pb = latexFrac(b.num, b.den);
      const steps = [
        `The two events are independent, so multiply their probabilities.`,
        `P(${a.text}) = ${m(pa)} and P(${b.text}) = ${m(pb)}`,
        m(
          `${pa} \\times ${pb} = ${latexFrac(num, den)}${g > 1 ? ` = ${latexFrac(num / g, den / g)}` : ""}`,
        ),
      ];

      return {
        promptMd: `${pair.setup}\n\nWork out the probability of getting ${a.text} and ${b.text}.`,
        inputType: "fraction",
        answerSpec: { kind: "fraction", num: num / g, den: den / g, mustBeSimplest: false },
        solution: { steps, final: m(latexFrac(num / g, den / g)) },
      };
    });
  },
};
