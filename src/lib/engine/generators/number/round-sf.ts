import type { QuestionGenerator } from "../../types";
import { fmt, fmtFixed, m } from "../../util/format";
import { clean, decimalsForSf, roundSf } from "../../util/numbers";
import { retry } from "../../util/retry";

const ORDINAL = ["", "first", "second", "third", "fourth"] as const;

export const roundSignificantFigures: QuestionGenerator = {
  key: "number.round.sf",
  topicSlug: "rounding-estimation",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const sf = rng.int(1, 3);
      const length = sf + rng.int(1, 3); // significant digits in the number
      const digits = rng.int(10 ** (length - 1), 10 ** length - 1);
      if (digits % 10 === 0) return null;
      const shift = rng.int(-(length + 2), 0);

      const x = clean(digits * 10 ** shift);
      const value = roundSf(x, sf);
      const decider = Number(String(digits)[sf]);
      const answer = fmtFixed(value, decimalsForSf(value, sf));

      return {
        promptMd: `Round ${m(fmt(x))} to ${sf} significant figure${sf > 1 ? "s" : ""}.`,
        inputType: "numeric",
        answerSpec: { kind: "decimal", value: x, sf },
        solution: {
          steps: [
            "The first significant figure is the first non-zero digit.",
            `Look at the digit after the ${ORDINAL[sf]} significant figure: it is ${decider}.`,
            decider >= 5
              ? `${decider} is 5 or more, so round up.`
              : `${decider} is less than 5, so round down.`,
            `${m(`${fmt(x)} \\approx ${answer}`)} (${sf} s.f.)`,
          ],
          final: answer,
        },
      };
    });
  },
};
