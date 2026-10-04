import type { QuestionGenerator } from "../../types";
import { fmt, m } from "../../util/format";
import { clean } from "../../util/numbers";

/** Number with thin-space thousands separators for display in LaTeX. */
function grouped(x: number): string {
  const [whole, frac] = fmt(x).split(".");
  const w = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\\,");
  return frac ? `${w}.${frac}` : w;
}

export const standardFormConvert: QuestionGenerator = {
  key: "number.standard-form.convert",
  topicSlug: "standard-form",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    const mantissa = rng.next() < 0.5 ? rng.int(1, 9) : clean(rng.int(11, 99) / 10);
    const exponent = rng.pick([-5, -4, -3, -2, -1, 2, 3, 4, 5]);
    const value = clean(mantissa * 10 ** exponent);
    const sf = `${fmt(mantissa)} \\times 10^{${exponent}}`;
    const toStandard = rng.next() < 0.5;

    if (toStandard) {
      return {
        promptMd: `Write ${m(grouped(value))} in standard form.`,
        inputType: "expression",
        answerSpec: { kind: "standardForm", mantissa, exponent },
        solution: {
          steps: [
            `Place the decimal point after the first non-zero digit: ${m(fmt(mantissa))}`,
            `Count how many places the digits moved: ${Math.abs(exponent)}, so the power of 10 is ${m(`${exponent}`)}.`,
            `${m(`${grouped(value)} = ${sf}`)}`,
          ],
          final: m(sf),
        },
      };
    }
    return {
      promptMd: `Write ${m(sf)} as an ordinary number.`,
      inputType: "numeric",
      answerSpec: { kind: "decimal", value },
      solution: {
        steps: [
          `Multiplying by ${m(`10^{${exponent}}`)} moves the decimal point ${Math.abs(exponent)} places to the ${exponent > 0 ? "right" : "left"}.`,
          `${m(`${sf} = ${grouped(value)}`)}`,
        ],
        final: fmt(value),
      },
    };
  },
};
