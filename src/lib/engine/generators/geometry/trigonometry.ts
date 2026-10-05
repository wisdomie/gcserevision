import type { GeneratedQuestion, QuestionGenerator } from "../../types";
import { fmtFixed, m } from "../../util/format";
import { roundDp } from "../../util/numbers";
import { retry } from "../../util/retry";
import { readableRatio, rightTriangle } from "./right-triangle";

type Side = "opp" | "adj" | "hyp";
const UNITS = ["cm", "m"] as const;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

const SIDE_NAME: Record<Side, string> = {
  opp: "opposite",
  adj: "adjacent",
  hyp: "hypotenuse",
};

/** Which ratio links two sides: SOH CAH TOA. */
function ratioFor(a: Side, b: Side): { fn: "sin" | "cos" | "tan"; top: Side; bottom: Side } {
  const pair = new Set([a, b]);
  if (pair.has("opp") && pair.has("hyp")) return { fn: "sin", top: "opp", bottom: "hyp" };
  if (pair.has("adj") && pair.has("hyp")) return { fn: "cos", top: "adj", bottom: "hyp" };
  return { fn: "tan", top: "opp", bottom: "adj" };
}

const dp1 = (x: number) => fmtFixed(roundDp(x, 1), 1);
const dp3 = (x: number) => fmtFixed(roundDp(x, 3), 3);

export const trigMissingSide: QuestionGenerator = {
  key: "geometry.trig.side",
  topicSlug: "trigonometry",
  tiers: ["foundation", "higher"],
  calculator: "calc",
  marks: 3,
  difficulty: 3,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    return retry(() => {
      const angle = rng.int(22, 68);
      const sides: Side[] = rng.shuffle(["opp", "adj", "hyp"]);
      const known = sides[0]!;
      const unknown = sides[1]!;
      const knownValue = rng.int(4, 25);
      const unit = rng.pick(UNITS);

      // All three sides from the known one
      const hyp =
        known === "hyp"
          ? knownValue
          : known === "opp"
            ? knownValue / Math.sin(rad(angle))
            : knownValue / Math.cos(rad(angle));
      const len: Record<Side, number> = {
        hyp,
        opp: hyp * Math.sin(rad(angle)),
        adj: hyp * Math.cos(rad(angle)),
      };
      if (!readableRatio(len.opp, len.adj)) return null;
      const x = len[unknown];
      if (x > 200) return null;

      const label = (s: Side) =>
        s === known ? `${knownValue} ${unit}` : s === unknown ? "x" : null;
      const diagram = rightTriangle(
        rng,
        len.adj,
        len.opp,
        { base: label("adj"), height: label("opp"), hypotenuse: label("hyp"), angle: `${angle}°` },
        `A right-angled triangle with an angle of ${angle} degrees. The ${SIDE_NAME[known]} side is ${knownValue} ${unit}. The ${SIDE_NAME[unknown]} side is marked x.`,
      );

      const { fn, top, bottom } = ratioFor(known, unknown);
      const v = (s: Side) => (s === known ? `${knownValue}` : "x");
      const solved =
        top === unknown
          ? `x = ${knownValue} \\times \\${fn} ${angle}^{\\circ}`
          : `x = \\frac{${knownValue}}{\\${fn} ${angle}^{\\circ}}`;
      return {
        promptMd: `Work out the length of the side marked ${m("x")}.\n\nGive your answer correct to 1 decimal place.`,
        inputType: "numeric",
        diagram,
        answerSpec: { kind: "decimal", value: x, dp: 1, unit },
        solution: {
          steps: [
            `You know the ${SIDE_NAME[known]} and want the ${SIDE_NAME[unknown]}, so use ${m(`\\${fn}`)}: ${m(`\\${fn} \\theta = \\frac{\\text{${SIDE_NAME[top]}}}{\\text{${SIDE_NAME[bottom]}}}`)}`,
            `${m(`\\${fn} ${angle}^{\\circ} = \\frac{${v(top)}}{${v(bottom)}}`)}`,
            `${m(`${solved} = ${dp3(x)}\\ldots`)}`,
          ],
          final: `${dp1(x)} ${unit}`,
        },
      } satisfies GeneratedQuestion;
    });
  },
};

export const trigMissingAngle: QuestionGenerator = {
  key: "geometry.trig.angle",
  topicSlug: "trigonometry",
  tiers: ["foundation", "higher"],
  calculator: "calc",
  marks: 3,
  difficulty: 4,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    return retry(() => {
      const unit = rng.pick(UNITS);
      const [s1, s2] = rng.shuffle<Side>(["opp", "adj", "hyp"]).slice(0, 2) as [Side, Side];
      const { fn, top, bottom } = ratioFor(s1, s2);
      const topValue = rng.int(3, 24);
      const bottomValue = rng.int(3, 24);
      if (fn !== "tan" && topValue >= bottomValue) return null;
      const ratio = topValue / bottomValue;
      const angle = deg(
        fn === "sin" ? Math.asin(ratio) : fn === "cos" ? Math.acos(ratio) : Math.atan(ratio),
      );
      if (angle < 15 || angle > 75) return null;

      const value: Partial<Record<Side, number>> = { [top]: topValue, [bottom]: bottomValue };
      const hyp = value.hyp ?? Math.hypot(value.opp ?? 0, value.adj ?? 0);
      const opp = value.opp ?? hyp * Math.sin(rad(angle));
      const adj = value.adj ?? hyp * Math.cos(rad(angle));
      if (!readableRatio(opp, adj)) return null;

      const label = (s: Side) => (value[s] !== undefined ? `${value[s]} ${unit}` : null);
      const diagram = rightTriangle(
        rng,
        adj,
        opp,
        { base: label("adj"), height: label("opp"), hypotenuse: label("hyp"), angle: "x" },
        `A right-angled triangle. The ${SIDE_NAME[top]} side is ${topValue} ${unit} and the ${SIDE_NAME[bottom]} side is ${bottomValue} ${unit}. The angle marked x is at the end of the adjacent side.`,
      );
      return {
        promptMd: `Work out the size of the angle marked ${m("x")}.\n\nGive your answer correct to 1 decimal place.`,
        inputType: "numeric",
        diagram,
        answerSpec: { kind: "decimal", value: angle, dp: 1, unit: "°" },
        solution: {
          steps: [
            `You know the ${SIDE_NAME[top]} and the ${SIDE_NAME[bottom]}, so use ${m(`\\${fn}`)}: ${m(`\\${fn} x = \\frac{${topValue}}{${bottomValue}}`)}`,
            `${m(`x = \\${fn}^{-1}\\left(\\frac{${topValue}}{${bottomValue}}\\right) = ${dp3(angle)}\\ldots`)}°`,
          ],
          final: `${dp1(angle)}°`,
        },
      } satisfies GeneratedQuestion;
    });
  },
};
