import type { QuestionGenerator } from "../../types";
import { fmt, m } from "../../util/format";
import { clean } from "../../util/numbers";
import { retry } from "../../util/retry";

const MANTISSAS = [1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8] as const;

export const standardFormCalc: QuestionGenerator = {
  key: "number.standard-form.calc",
  topicSlug: "standard-form",
  tiers: ["higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const multiply = rng.next() < 0.5;
      const p = rng.int(-6, 9);
      const q = rng.int(-6, 9);
      if ([0, 1].includes(p) || [0, 1].includes(q)) return null;

      let a: number, b: number, rawMantissa: number, rawExponent: number;
      if (multiply) {
        a = rng.pick(MANTISSAS);
        b = rng.pick(MANTISSAS);
        rawMantissa = clean(a * b);
        rawExponent = p + q;
      } else {
        const result = rng.pick(MANTISSAS);
        b = rng.pick(MANTISSAS);
        a = clean(result * b);
        if (a >= 10) return null;
        rawMantissa = result;
        rawExponent = p - q;
      }

      let mantissa = rawMantissa;
      let exponent = rawExponent;
      if (mantissa >= 10) {
        mantissa = clean(mantissa / 10);
        exponent += 1;
      }
      if ([0, 1].includes(exponent) || Math.abs(exponent) > 15) return null;

      const op = multiply ? "\\times" : "\\div";
      const left = `(${fmt(a)} \\times 10^{${p}})`;
      const right = `(${fmt(b)} \\times 10^{${q}})`;
      const answer = `${fmt(mantissa)} \\times 10^{${exponent}}`;
      const steps = [
        `${multiply ? "Multiply" : "Divide"} the numbers: ${m(`${fmt(a)} ${op} ${fmt(b)} = ${fmt(rawMantissa)}`)}`,
        `${multiply ? "Add" : "Subtract"} the powers of 10: ${m(`10^{${p}} ${op} 10^{${q}} = 10^{${rawExponent}}`)}`,
      ];
      if (rawMantissa >= 10) {
        steps.push(
          `${m(fmt(rawMantissa))} is not between 1 and 10, so adjust: ${m(`${fmt(rawMantissa)} \\times 10^{${rawExponent}} = ${answer}`)}`,
        );
      } else {
        steps.push(`So the answer is ${m(answer)}`);
      }

      return {
        promptMd: `Work out ${m(`${left} ${op} ${right}`)}.\n\nGive your answer in standard form.`,
        inputType: "expression",
        answerSpec: { kind: "standardForm", mantissa, exponent },
        solution: { steps, final: m(answer) },
      };
    });
  },
};
