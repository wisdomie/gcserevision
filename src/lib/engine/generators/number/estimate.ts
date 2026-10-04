import type { QuestionGenerator, Rng } from "../../types";
import { fmt, m } from "../../util/format";
import { clean, magnitude, roundSf } from "../../util/numbers";
import { retry } from "../../util/retry";

/** A 3-significant-figure number that rounds to `rounded` at 1 s.f. */
function near(rng: Rng, rounded: number): number | null {
  const place = 10 ** magnitude(rounded);
  const x = clean(rounded + (rng.int(-30, 30) / 100) * place);
  if (x === rounded || roundSf(x, 1) !== rounded || x <= 0) return null;
  return clean(roundSf(x, 3));
}

export const estimate: QuestionGenerator = {
  key: "number.estimate",
  topicSlug: "rounding-estimation",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const scale = () => rng.pick([0.1, 1, 10, 100]);
      const ra = clean(rng.int(2, 9) * scale());
      const rb = clean(rng.int(2, 9) * scale());
      const divide = rng.next() < 0.5;
      const rc = divide ? clean(rng.int(2, 9) * rng.pick([0.1, 1, 10])) : 1;

      const value = clean((ra * rb) / rc);
      // Keep the estimate itself easy to work out and write down
      if (value <= 0 || value >= 100000 || clean(value * 100) % 1 !== 0) return null;

      const a = near(rng, ra);
      const b = near(rng, rb);
      const c = divide ? near(rng, rc) : 1;
      if (a === null || b === null || c === null) return null;

      const exact = divide
        ? `\\frac{${fmt(a)} \\times ${fmt(b)}}{${fmt(c)}}`
        : `${fmt(a)} \\times ${fmt(b)}`;
      const rounded = divide
        ? `\\frac{${fmt(ra)} \\times ${fmt(rb)}}{${fmt(rc)}}`
        : `${fmt(ra)} \\times ${fmt(rb)}`;
      const answer = fmt(value);
      const roundings = [
        `${fmt(a)} \\approx ${fmt(ra)}`,
        `${fmt(b)} \\approx ${fmt(rb)}`,
        ...(divide ? [`${fmt(c)} \\approx ${fmt(rc)}`] : []),
      ];

      return {
        promptMd: `By rounding each number to 1 significant figure, estimate the value of ${m(exact)}.`,
        inputType: "numeric",
        answerSpec: Number.isInteger(value)
          ? { kind: "integer", value }
          : { kind: "decimal", value },
        solution: {
          steps: [
            `Round each number to 1 significant figure: ${roundings.map(m).join(", ")}`,
            `Work out the estimate: ${m(`${rounded} = ${answer}`)}`,
          ],
          final: answer,
        },
      };
    });
  },
};
