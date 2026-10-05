import type { BarDiagram, GraphDiagram, Point } from "../../diagram";
import type { GeneratedQuestion, QuestionGenerator, Rng } from "../../types";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

const SURVEYS = [
  {
    what: "favourite fruit",
    intro: "the favourite fruit of a group of students",
    label: "Fruit",
    items: ["Apple", "Banana", "Grape", "Mango", "Pear", "Kiwi"],
  },
  {
    what: "favourite sport",
    intro: "the favourite sport of a group of students",
    label: "Sport",
    items: ["Football", "Tennis", "Netball", "Rugby", "Hockey", "Golf"],
  },
  {
    what: "how students get to school",
    intro: "how a group of students get to school",
    label: "Travel",
    items: ["Walk", "Bus", "Car", "Bike", "Train"],
  },
  {
    what: "favourite colour",
    intro: "the favourite colour of a group of students",
    label: "Colour",
    items: ["Red", "Blue", "Green", "Yellow", "Purple"],
  },
] as const;

export const barChart: QuestionGenerator = {
  key: "stats.bar-chart",
  topicSlug: "charts-tables",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 1,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    return retry(() => {
      const survey = rng.pick(SURVEYS);
      const items = rng.shuffle(survey.items).slice(0, rng.int(4, 5));
      const step = rng.pick([1, 2]);
      const values = items.map(() => rng.int(1, 10) * step);
      const max = Math.max(...values);
      const top = Math.ceil((max + 1) / step) * step;
      const diagram: BarDiagram = {
        kind: "bar",
        alt: `Bar chart of ${survey.what}: ${items.map((it, i) => `${it} ${values[i]}`).join(", ")}.`,
        categories: [...items],
        values,
        y: { min: 0, max: top, step, label: "Frequency" },
        xLabel: survey.label,
      };
      const intro = `The bar chart shows ${survey.intro}.`;
      const kind = rng.int(0, 2);

      if (kind === 0) {
        const total = values.reduce((s, v) => s + v, 0);
        return {
          promptMd: `${intro}\n\nHow many students are in the group?`,
          inputType: "numeric",
          diagram,
          answerSpec: { kind: "integer", value: total },
          solution: {
            steps: [`Add up the heights of all the bars: ${m(`${values.join(" + ")} = ${total}`)}`],
            final: `${total}`,
          },
        } satisfies GeneratedQuestion;
      }

      if (kind === 1) {
        const [i, j] = rng.shuffle(items.map((_, k) => k)).slice(0, 2) as [number, number];
        const [hi, lo] = values[i]! > values[j]! ? [i, j] : [j, i];
        if (values[hi] === values[lo]) return null;
        const diff = values[hi]! - values[lo]!;
        return {
          promptMd: `${intro}\n\nHow many more students chose ${items[hi]} than ${items[lo]}?`,
          inputType: "numeric",
          diagram,
          answerSpec: { kind: "integer", value: diff },
          solution: {
            steps: [
              `${items[hi]}: ${values[hi]} students. ${items[lo]}: ${values[lo]} students.`,
              `${m(`${values[hi]} - ${values[lo]} = ${diff}`)}`,
            ],
            final: `${diff}`,
          },
        } satisfies GeneratedQuestion;
      }

      // The mode: the tallest bar, which must be unique
      if (values.filter((v) => v === max).length > 1) return null;
      const mode = items[values.indexOf(max)]!;
      const options = rng.shuffle([
        mode,
        ...rng.shuffle(items.filter((it) => it !== mode)).slice(0, 3),
      ]);
      return {
        promptMd: `${intro}\n\nWhat is the mode?`,
        inputType: "mcq",
        diagram,
        options,
        answerSpec: { kind: "mcq", correctIndex: options.indexOf(mode) },
        solution: {
          steps: [
            `The mode is the most common answer: the tallest bar, ${mode} with ${max} students.`,
          ],
          final: mode,
        },
      } satisfies GeneratedQuestion;
    });
  },
};

const CONTEXTS = [
  {
    x: "Hours of revision",
    y: "Test score (%)",
    xMax: 10,
    yMax: 100,
    xStep: 1,
    yStep: 10,
    trend: "positive",
  },
  {
    x: "Temperature (°C)",
    y: "Hot drinks sold",
    xMax: 30,
    yMax: 60,
    xStep: 5,
    yStep: 10,
    trend: "negative",
  },
  {
    x: "Age of car (years)",
    y: "Value (£1000s)",
    xMax: 10,
    yMax: 20,
    xStep: 1,
    yStep: 2,
    trend: "negative",
  },
  {
    x: "Height (cm)",
    y: "Arm span (cm)",
    xMax: 200,
    yMax: 200,
    xStep: 10,
    yStep: 10,
    trend: "positive",
  },
  { x: "Shoe size", y: "Test score (%)", xMax: 12, yMax: 100, xStep: 1, yStep: 10, trend: "none" },
  {
    x: "House number",
    y: "Height (cm)",
    xMax: 100,
    yMax: 200,
    xStep: 10,
    yStep: 20,
    trend: "none",
  },
] as const;

type Trend = "positive" | "negative" | "none";

function correlation(points: Point[]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const my = points.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function scatterPoints(rng: Rng, trend: Trend, xMax: number, yMax: number): Point[] {
  const n = rng.int(10, 14);
  const lowX = xMax === 200 ? 140 : 0;
  const lowY = yMax === 200 && trend !== "none" ? 140 : 0;
  return Array.from({ length: n }, () => {
    const t = rng.next();
    const x = lowX + t * (xMax - lowX) * 0.9 + (xMax - lowX) * 0.05;
    const noise = (rng.next() - 0.5) * 0.3;
    const share =
      trend === "positive"
        ? 0.1 + 0.8 * t + noise
        : trend === "negative"
          ? 0.9 - 0.8 * t + noise
          : 0.1 + 0.8 * rng.next();
    const y = lowY + Math.min(0.95, Math.max(0.05, share)) * (yMax - lowY);
    return [Math.round(x * 10) / 10, Math.round(y)] as Point;
  });
}

const ANSWERS: Record<Trend, string> = {
  positive: "Positive correlation",
  negative: "Negative correlation",
  none: "No correlation",
};

export const scatterCorrelation: QuestionGenerator = {
  key: "stats.scatter.correlation",
  topicSlug: "scatter-graphs",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 1,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    return retry(() => {
      const ctx = rng.pick(CONTEXTS);
      const points = scatterPoints(rng, ctx.trend, ctx.xMax, ctx.yMax);
      const r = correlation(points);
      if (ctx.trend === "positive" && r < 0.7) return null;
      if (ctx.trend === "negative" && r > -0.7) return null;
      if (ctx.trend === "none" && Math.abs(r) > 0.25) return null;

      const lowX = ctx.xMax === 200 ? 140 : 0;
      const lowY = ctx.yMax === 200 && ctx.trend !== "none" ? 140 : 0;
      const diagram: GraphDiagram = {
        kind: "graph",
        alt: `Scatter graph of ${ctx.y.toLowerCase()} against ${ctx.x.toLowerCase()}. Points: ${points.map(([x, y]) => `(${x}, ${y})`).join(", ")}.`,
        x: { min: lowX, max: ctx.xMax, step: ctx.xStep, label: ctx.x },
        y: { min: lowY, max: ctx.yMax, step: ctx.yStep, label: ctx.y },
        lines: [],
        points,
      };
      const correct = ANSWERS[ctx.trend];
      const options = rng.shuffle([
        ...Object.values(ANSWERS),
        "You can't tell from a scatter graph",
      ]);
      const why: Record<Trend, string> = {
        positive: `As ${ctx.x.toLowerCase()} increases, ${ctx.y.toLowerCase()} tends to increase too.`,
        negative: `As ${ctx.x.toLowerCase()} increases, ${ctx.y.toLowerCase()} tends to decrease.`,
        none: "The points are spread out with no pattern going up or down.",
      };
      return {
        promptMd: `The scatter graph shows ${ctx.y.toLowerCase()} and ${ctx.x.toLowerCase()} for a group of people.\n\nWhat type of correlation does it show?`,
        inputType: "mcq",
        diagram,
        options,
        answerSpec: { kind: "mcq", correctIndex: options.indexOf(correct) },
        solution: { steps: [why[ctx.trend]], final: correct },
      } satisfies GeneratedQuestion;
    });
  },
};
