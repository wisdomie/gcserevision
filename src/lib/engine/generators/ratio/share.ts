import type { QuestionGenerator } from "../../types";
import { m } from "../../util/format";
import { gcd } from "../../util/numbers";
import { retry } from "../../util/retry";

const NAMES = [
  "Amir",
  "Bella",
  "Chen",
  "Dani",
  "Ellis",
  "Freya",
  "Gus",
  "Hana",
  "Isaac",
  "Jade",
] as const;

export const ratioShare: QuestionGenerator = {
  key: "ratio.share",
  topicSlug: "ratio",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const threeWay = rng.next() < 0.3;
      const parts = Array.from({ length: threeWay ? 3 : 2 }, () => rng.int(1, 9));
      if (parts.reduce(gcd) !== 1 || new Set(parts).size !== parts.length) return null;
      const totalParts = parts.reduce((a, b) => a + b, 0);
      const onePart = rng.int(2, 50);
      const total = totalParts * onePart;
      if (total > 1000) return null;

      const names = rng.shuffle(NAMES).slice(0, parts.length);
      const asked = rng.int(0, parts.length - 1);
      const answer = parts[asked] * onePart;
      const who =
        names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names[0]}, ${names[1]} and ${names[2]}`;

      return {
        promptMd: `${who} share £${total} in the ratio ${m(parts.join(" : "))}.\n\nHow much does ${names[asked]} get?`,
        inputType: "numeric",
        answerSpec: { kind: "integer", value: answer },
        solution: {
          steps: [
            `Add the parts of the ratio: ${m(`${parts.join(" + ")} = ${totalParts}`)}`,
            `Find the value of one part: ${m(`${total} \\div ${totalParts} = ${onePart}`)}`,
            `${names[asked]} gets ${parts[asked]} part${parts[asked] > 1 ? "s" : ""}: ${m(`${parts[asked]} \\times ${onePart} = ${answer}`)}`,
          ],
          final: `£${answer}`,
        },
      };
    });
  },
};
