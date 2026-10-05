import type { GraphDiagram, Point } from "../../diagram";
import type { GeneratedQuestion, QuestionGenerator } from "../../types";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

const X = { min: -5, max: 5, step: 1 } as const;
const Y = { min: -8, max: 8, step: 1 } as const;

/** y = mx + c as LaTeX: "y = 2x - 3", "y = -x", "y = 4". */
function equation(mGrad: number, c: number): string {
  const xTerm = mGrad === 0 ? "" : mGrad === 1 ? "x" : mGrad === -1 ? "-x" : `${mGrad}x`;
  if (!xTerm) return `y = ${c}`;
  if (c === 0) return `y = ${xTerm}`;
  return `y = ${xTerm} ${c > 0 ? "+" : "-"} ${Math.abs(c)}`;
}

/** The part of y = mx + c inside the grid. */
function clip(mGrad: number, c: number): [Point, Point] {
  const xs = [X.min, X.max, (Y.min - c) / mGrad, (Y.max - c) / mGrad]
    .filter((x) => x >= X.min && x <= X.max)
    .filter((x) => {
      const y = mGrad * x + c;
      return y >= Y.min - 1e-9 && y <= Y.max + 1e-9;
    })
    .sort((a, b) => a - b);
  const from = xs[0]!;
  const to = xs.at(-1)!;
  return [
    [from, mGrad * from + c],
    [to, mGrad * to + c],
  ];
}

export const straightLineGraph: QuestionGenerator = {
  key: "algebra.straight-line.gradient",
  topicSlug: "straight-line-graphs",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 3,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    return retry(() => {
      const mGrad = rng.pick([-3, -2, -1, 1, 2, 3]);
      const c = rng.int(-4, 4);
      const [from, to] = clip(mGrad, c);
      if (to[0] - from[0] < 3) return null;

      // Two clear points on the line to read the gradient from
      const x1 = Math.max(Math.ceil(from[0]), -3);
      const x2 = x1 + 1;
      const y1 = mGrad * x1 + c;
      const y2 = mGrad * x2 + c;
      const diagram: GraphDiagram = {
        kind: "graph",
        equalScale: true,
        alt: `A straight line drawn on a grid from x = ${X.min} to ${X.max}. It passes through the points (${x1}, ${y1}) and (${x2}, ${y2}).`,
        x: { ...X, label: "x" },
        y: { ...Y, label: "y" },
        lines: [{ from, to }],
        points: [],
      };
      const rise = `${y2} - ${y1 < 0 ? `(${y1})` : y1}`;
      const findGradient = [
        `Pick two points on the line, such as ${m(`(${x1}, ${y1})`)} and ${m(`(${x2}, ${y2})`)}.`,
        `Gradient = ${m("\\frac{\\text{change in } y}{\\text{change in } x}")} = ${m(`\\frac{${rise}}{${x2} - ${x1 < 0 ? `(${x1})` : x1}} = ${mGrad}`)}`,
      ];

      if (rng.next() < 0.5) {
        return {
          promptMd: `The graph shows a straight line.\n\nWork out the gradient of the line.`,
          inputType: "numeric",
          diagram,
          answerSpec: { kind: "integer", value: mGrad },
          solution: { steps: findGradient, final: `${mGrad}` },
        } satisfies GeneratedQuestion;
      }

      const correct = equation(mGrad, c);
      const wrongs = [
        equation(-mGrad, c),
        equation(c === 0 ? mGrad + 1 : c, mGrad),
        equation(mGrad, -c),
      ];
      const options = [
        ...new Set([correct, ...wrongs, equation(mGrad, c + (c >= 0 ? 1 : -1))]),
      ].slice(0, 4);
      if (options.length < 4) return null;
      const shuffled = rng.shuffle(options);
      return {
        promptMd: `The graph shows a straight line.\n\nWhich is the equation of the line?`,
        inputType: "mcq",
        diagram,
        options: shuffled.map(m),
        answerSpec: { kind: "mcq", correctIndex: shuffled.indexOf(correct) },
        solution: {
          steps: [
            ...findGradient,
            `The line crosses the ${m("y")}-axis at ${m(`(0, ${c})`)}, so the ${m("y")}-intercept is ${m(`${c}`)}.`,
            `So the equation is ${m(correct)}.`,
          ],
          final: m(correct),
        },
      } satisfies GeneratedQuestion;
    });
  },
};
