import type { QuestionGenerator } from "../../types";
import { fmtFixed, m } from "../../util/format";
import { clean, roundDp } from "../../util/numbers";
import { retry } from "../../util/retry";

const ORDINAL = ["", "first", "second", "third", "fourth"] as const;

export const roundDecimalPlaces: QuestionGenerator = {
  key: "number.round.dp",
  topicSlug: "rounding-estimation",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 1,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const dp = rng.int(1, 3);
      const places = dp + rng.int(1, 2); // digits shown after the point
      const whole = rng.int(0, 99);
      const frac = rng.int(1, 10 ** places - 1);
      if (frac % 10 === 0) return null; // keep every shown digit meaningful

      const x = clean(whole + frac / 10 ** places);
      const value = roundDp(x, dp);
      const decider = Math.floor(frac / 10 ** (places - dp - 1)) % 10;
      const shown = fmtFixed(x, places);
      const answer = fmtFixed(value, dp);

      return {
        promptMd: `Round ${m(shown)} to ${dp} decimal place${dp > 1 ? "s" : ""}.`,
        inputType: "numeric",
        answerSpec: { kind: "decimal", value: x, dp },
        solution: {
          steps: [
            `Look at the digit in the ${ORDINAL[dp + 1]} decimal place: it is ${decider}.`,
            decider >= 5
              ? `${decider} is 5 or more, so round up.`
              : `${decider} is less than 5, so round down.`,
            `${m(`${shown} \\approx ${answer}`)} (${dp} d.p.)`,
          ],
          final: answer,
        },
      };
    });
  },
};
