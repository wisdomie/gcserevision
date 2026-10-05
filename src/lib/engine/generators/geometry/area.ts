import {
  polygonSideLabels,
  tidy,
  type DiagramLabel,
  type GeometryDiagram,
  type Point,
} from "../../diagram";
import type { GeneratedQuestion, QuestionGenerator, Rng } from "../../types";
import { fmt, m } from "../../util/format";
import { clean } from "../../util/numbers";
import { retry } from "../../util/retry";

const UNITS = ["cm", "m", "mm"] as const;
type Unit = (typeof UNITS)[number];

interface Shape {
  name: string;
  area: number;
  steps: string[];
  diagram: GeometryDiagram;
}

/** Scales real lengths into drawing units: the widest part is about 200 across. */
const scaler = (widest: number) => (x: number) => (x * 200) / widest;

/** A dashed-style height: a line from the top down to the base, with a right angle. */
function heightLine(top: Point, foot: Point, toward: Point, text: string) {
  return {
    shape: { points: [top, foot], closed: false },
    rightAngle: { at: foot, a: top, b: toward },
    label: {
      at: tidy([foot[0] + 6, (top[1] + foot[1]) / 2]),
      text,
      anchor: "start",
    } satisfies DiagramLabel,
  };
}

function rectangle(rng: Rng, unit: Unit): Shape | null {
  const l = rng.int(3, 20);
  const w = rng.int(2, 15);
  if (l === w || Math.max(l, w) / Math.min(l, w) > 3) return null;
  const s = scaler(Math.max(l, w));
  const pts: Point[] = [
    [0, 0],
    [s(l), 0],
    [s(l), s(w)],
    [0, s(w)],
  ].map((p) => tidy(p as Point));
  return {
    name: "rectangle",
    area: l * w,
    steps: [`Area of a rectangle = length × width`, `${m(`${l} \\times ${w} = ${l * w}`)}`],
    diagram: {
      kind: "geometry",
      alt: `A rectangle ${l} ${unit} long and ${w} ${unit} wide.`,
      shapes: [{ points: pts, closed: true }],
      labels: polygonSideLabels(pts, [`${l} ${unit}`, `${w} ${unit}`, null, null]),
      rightAngles: [{ at: pts[0]!, a: pts[1]!, b: pts[3]! }],
      arcs: [],
    },
  };
}

function triangle(rng: Rng, unit: Unit): Shape | null {
  const b = rng.int(4, 20);
  const h = rng.int(3, 16);
  if (Math.max(b, h) / Math.min(b, h) > 3) return null;
  const s = scaler(Math.max(b, h));
  const apexAt = rng.int(25, 75) / 100;
  const P: Point = [0, 0];
  const Q: Point = tidy([s(b), 0]);
  const R: Point = tidy([s(b) * apexAt, s(h)]);
  const foot: Point = [R[0], 0];
  const hl = heightLine(R, foot, Q, `${h} ${unit}`);
  const area = clean((b * h) / 2);
  return {
    name: "triangle",
    area,
    steps: [
      `Area of a triangle = ${m("\\frac{1}{2}")} × base × perpendicular height`,
      `${m(`\\frac{1}{2} \\times ${b} \\times ${h} = ${fmt(area)}`)}`,
    ],
    diagram: {
      kind: "geometry",
      alt: `A triangle with a base of ${b} ${unit} and a perpendicular height of ${h} ${unit}.`,
      shapes: [{ points: [P, Q, R], closed: true }, hl.shape],
      labels: [...polygonSideLabels([P, Q, R], [`${b} ${unit}`, null, null]), hl.label],
      rightAngles: [hl.rightAngle],
      arcs: [],
    },
  };
}

function parallelogram(rng: Rng, unit: Unit): Shape | null {
  const b = rng.int(4, 20);
  const h = rng.int(3, 15);
  if (Math.max(b, h) / Math.min(b, h) > 3) return null;
  const s = scaler(b * 1.3);
  const offset = s(b) * 0.3;
  const pts: Point[] = [
    [0, 0],
    [s(b), 0],
    [s(b) + offset, s(h)],
    [offset, s(h)],
  ].map((p) => tidy(p as Point));
  const foot: Point = tidy([offset, 0]);
  const hl = heightLine(pts[3]!, foot, pts[1]!, `${h} ${unit}`);
  return {
    name: "parallelogram",
    area: b * h,
    steps: [
      `Area of a parallelogram = base × perpendicular height`,
      `${m(`${b} \\times ${h} = ${b * h}`)}`,
    ],
    diagram: {
      kind: "geometry",
      alt: `A parallelogram with a base of ${b} ${unit} and a perpendicular height of ${h} ${unit}.`,
      shapes: [{ points: pts, closed: true }, hl.shape],
      labels: [...polygonSideLabels(pts, [`${b} ${unit}`, null, null, null]), hl.label],
      rightAngles: [hl.rightAngle],
      arcs: [],
    },
  };
}

function trapezium(rng: Rng, unit: Unit): Shape | null {
  const bottom = rng.int(6, 20);
  const top = rng.int(3, bottom - 2);
  const h = rng.int(3, 14);
  if (bottom / h > 3 || h / bottom > 3) return null;
  const s = scaler(bottom);
  const offset = (s(bottom) - s(top)) * (rng.int(20, 80) / 100);
  const pts: Point[] = [
    [0, 0],
    [s(bottom), 0],
    [offset + s(top), s(h)],
    [offset, s(h)],
  ].map((p) => tidy(p as Point));
  const foot: Point = tidy([offset, 0]);
  const hl = heightLine(pts[3]!, foot, pts[1]!, `${h} ${unit}`);
  const area = clean(((top + bottom) * h) / 2);
  return {
    name: "trapezium",
    area,
    steps: [
      `Area of a trapezium = ${m("\\frac{1}{2}(a + b)h")}, where ${m("a")} and ${m("b")} are the parallel sides`,
      `${m(`\\frac{1}{2} \\times (${top} + ${bottom}) \\times ${h} = \\frac{1}{2} \\times ${top + bottom} \\times ${h} = ${fmt(area)}`)}`,
    ],
    diagram: {
      kind: "geometry",
      alt: `A trapezium with parallel sides of ${top} ${unit} and ${bottom} ${unit}, and a perpendicular height of ${h} ${unit}.`,
      shapes: [{ points: pts, closed: true }, hl.shape],
      labels: [
        ...polygonSideLabels(pts, [`${bottom} ${unit}`, null, `${top} ${unit}`, null]),
        hl.label,
      ],
      rightAngles: [hl.rightAngle],
      arcs: [],
    },
  };
}

const SHAPES = [rectangle, triangle, parallelogram, trapezium];

export const areaOfShapes: QuestionGenerator = {
  key: "geometry.area.shapes",
  topicSlug: "perimeter-area",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    const make = rng.pick(SHAPES);
    return retry(() => {
      const unit = rng.pick(UNITS);
      const shape = make(rng, unit);
      if (!shape) return null;
      return {
        promptMd: `Work out the area of this ${shape.name}.\n\nGive your answer in ${unit}².`,
        inputType: "numeric",
        diagram: shape.diagram,
        answerSpec: { kind: "decimal", value: shape.area, unit: `${unit}²` },
        solution: { steps: shape.steps, final: `${fmt(shape.area)} ${unit}²` },
      } satisfies GeneratedQuestion;
    });
  },
};
