import type { GeneratedQuestion, QuestionGenerator } from "../../types";
import { fmt, fmtFixed, m } from "../../util/format";
import { roundDp } from "../../util/numbers";
import { retry } from "../../util/retry";
import { readableRatio, rightTriangle } from "./right-triangle";

const UNITS = ["cm", "m", "mm"] as const;

/** Exact answers are whole numbers; anything else is rounded to 1 dp. */
function lengthAnswer(x: number, unit: string) {
  const exact = Number.isInteger(roundDp(x, 9));
  const value = exact ? Math.round(x) : x;
  return {
    exact,
    shown: exact ? fmt(value) : fmtFixed(roundDp(x, 1), 1),
    answerSpec: exact
      ? ({ kind: "decimal", value, unit } as const)
      : ({ kind: "decimal", value, dp: 1, unit } as const),
  };
}

const roundingNote = (exact: boolean) =>
  exact ? "" : "\n\nGive your answer correct to 1 decimal place.";

export const pythagorasHypotenuse: QuestionGenerator = {
  key: "geometry.pythagoras.hypotenuse",
  topicSlug: "pythagoras",
  tiers: ["foundation", "higher"],
  calculator: "calc",
  marks: 3,
  difficulty: 2,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    return retry(() => {
      const a = rng.int(3, 24);
      const b = rng.int(3, 24);
      if (!readableRatio(a, b)) return null;
      const unit = rng.pick(UNITS);
      const x = Math.sqrt(a * a + b * b);
      const ans = lengthAnswer(x, unit);
      const diagram = rightTriangle(
        rng,
        a,
        b,
        { base: `${a} ${unit}`, height: `${b} ${unit}`, hypotenuse: "x" },
        `A right-angled triangle. The two shorter sides are ${a} ${unit} and ${b} ${unit}. The longest side is marked x.`,
      );
      return {
        promptMd: `Work out the length of the side marked ${m("x")}.${roundingNote(ans.exact)}`,
        inputType: "numeric",
        diagram,
        answerSpec: ans.answerSpec,
        solution: {
          steps: [
            `${m("x")} is the hypotenuse (the longest side), so ${m("x^2 = " + a + "^2 + " + b + "^2")}`,
            `${m(`x^2 = ${a * a} + ${b * b} = ${a * a + b * b}`)}`,
            `${m(`x = \\sqrt{${a * a + b * b}} = ${ans.exact ? ans.shown : fmtFixed(roundDp(x, 3), 3) + "\\ldots"}`)}`,
          ],
          final: `${ans.shown} ${unit}`,
        },
      } satisfies GeneratedQuestion;
    });
  },
};

export const pythagorasShorterSide: QuestionGenerator = {
  key: "geometry.pythagoras.shorter-side",
  topicSlug: "pythagoras",
  tiers: ["foundation", "higher"],
  calculator: "calc",
  marks: 3,
  difficulty: 3,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    return retry(() => {
      const c = rng.int(6, 30);
      const a = rng.int(3, c - 2);
      const x = Math.sqrt(c * c - a * a);
      if (!readableRatio(a, x)) return null;
      const unit = rng.pick(UNITS);
      const ans = lengthAnswer(x, unit);
      const unknownIsBase = rng.next() < 0.5;
      const diagram = rightTriangle(
        rng,
        unknownIsBase ? x : a,
        unknownIsBase ? a : x,
        {
          base: unknownIsBase ? "x" : `${a} ${unit}`,
          height: unknownIsBase ? `${a} ${unit}` : "x",
          hypotenuse: `${c} ${unit}`,
        },
        `A right-angled triangle. The longest side is ${c} ${unit} and one shorter side is ${a} ${unit}. The other shorter side is marked x.`,
      );
      return {
        promptMd: `Work out the length of the side marked ${m("x")}.${roundingNote(ans.exact)}`,
        inputType: "numeric",
        diagram,
        answerSpec: ans.answerSpec,
        solution: {
          steps: [
            `The hypotenuse is ${m(`${c}`)}, so ${m(`x^2 + ${a}^2 = ${c}^2`)}`,
            `${m(`x^2 = ${c * c} - ${a * a} = ${c * c - a * a}`)}`,
            `${m(`x = \\sqrt{${c * c - a * a}} = ${ans.exact ? ans.shown : fmtFixed(roundDp(x, 3), 3) + "\\ldots"}`)}`,
          ],
          final: `${ans.shown} ${unit}`,
        },
      } satisfies GeneratedQuestion;
    });
  },
};
