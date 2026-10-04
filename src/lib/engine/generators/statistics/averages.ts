import type { QuestionGenerator } from "../../types";
import { fmt, m } from "../../util/format";
import { clean } from "../../util/numbers";
import { retry } from "../../util/retry";

const list = (xs: number[]) => m(xs.join(",\\; "));

export const mean: QuestionGenerator = {
  key: "stats.mean",
  topicSlug: "averages",
  tiers: ["foundation", "higher"],
  calculator: "either",
  marks: 2,
  difficulty: 1,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const n = rng.int(4, 8);
      const xs = Array.from({ length: n }, () => rng.int(1, 30));
      const sum = xs.reduce((a, b) => a + b, 0);
      const value = clean(sum / n);
      if (clean(value * 10) % 1 !== 0) return null; // mean has at most 1 decimal place

      return {
        promptMd: `Here are ${n} numbers:\n\n${list(xs)}\n\nWork out the mean.`,
        inputType: "numeric",
        answerSpec: { kind: "decimal", value },
        solution: {
          steps: [
            `Add the numbers: ${m(`${xs.join(" + ")} = ${sum}`)}`,
            `Divide by how many numbers there are: ${m(`${sum} \\div ${n} = ${fmt(value)}`)}`,
          ],
          final: fmt(value),
        },
      };
    });
  },
};

export const medianRange: QuestionGenerator = {
  key: "stats.median-range",
  topicSlug: "averages",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    const n = rng.int(5, 10);
    const xs = Array.from({ length: n }, () => rng.int(1, 40));
    const sorted = [...xs].sort((a, b) => a - b);
    const askMedian = rng.next() < 0.6;

    if (!askMedian) {
      const range = sorted[n - 1] - sorted[0];
      return {
        promptMd: `Here are ${n} numbers:\n\n${list(xs)}\n\nWork out the range.`,
        inputType: "numeric",
        answerSpec: { kind: "integer", value: range },
        solution: {
          steps: [
            `The largest number is ${sorted[n - 1]} and the smallest is ${sorted[0]}.`,
            `Range = largest − smallest: ${m(`${sorted[n - 1]} - ${sorted[0]} = ${range}`)}`,
          ],
          final: `${range}`,
        },
      };
    }

    const mid = Math.floor(n / 2);
    const median = n % 2 ? sorted[mid] : clean((sorted[mid - 1] + sorted[mid]) / 2);
    return {
      promptMd: `Here are ${n} numbers:\n\n${list(xs)}\n\nWork out the median.`,
      inputType: "numeric",
      answerSpec: { kind: "decimal", value: median },
      solution: {
        steps: [
          `Put the numbers in order: ${list(sorted)}`,
          n % 2
            ? `There are ${n} numbers, so the median is the middle one (the ${mid + 1}th): ${m(`${median}`)}`
            : `There are ${n} numbers, so the median is halfway between the ${mid}th and ${mid + 1}th: ${m(`(${sorted[mid - 1]} + ${sorted[mid]}) \\div 2 = ${fmt(median)}`)}`,
        ],
        final: fmt(median),
      },
    };
  },
};

export const meanFromTotal: QuestionGenerator = {
  key: "stats.mean-from-total",
  topicSlug: "averages",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 3,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const n = rng.int(4, 7);
      const average = rng.int(5, 20);
      const known = Array.from({ length: n - 1 }, () => rng.int(1, 30));
      const total = average * n;
      const missing = total - known.reduce((a, b) => a + b, 0);
      if (missing < 1 || missing > 40) return null;
      const knownSum = total - missing;

      return {
        promptMd: `The mean of ${n} numbers is ${average}.\n\n${n - 1} of the numbers are ${list(known)}\n\nWork out the missing number.`,
        inputType: "numeric",
        answerSpec: { kind: "integer", value: missing },
        solution: {
          steps: [
            `The total of all ${n} numbers is mean × how many: ${m(`${average} \\times ${n} = ${total}`)}`,
            `Add the numbers you know: ${m(`${known.join(" + ")} = ${knownSum}`)}`,
            `The missing number is the difference: ${m(`${total} - ${knownSum} = ${missing}`)}`,
          ],
          final: `${missing}`,
        },
      };
    });
  },
};
