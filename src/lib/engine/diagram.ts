// Typed question diagrams (PLAN.md M7). Generators describe a diagram as data;
// the client draws it as inline SVG (src/components/math/Diagram.tsx). A
// diagram is part of the public question, so it must never give away the
// answer: label the unknown "x" or "?".

import { z } from "zod";

/** [x, y] with y pointing up. */
export type Point = [number, number];

export type TextAnchor = "start" | "middle" | "end";

export interface DiagramLabel {
  at: Point;
  text: string;
  anchor?: TextAnchor;
}

/**
 * Shapes, labels and angle marks in drawing units (about 0–240 across;
 * labels are 14 units high). Geometry diagrams are not drawn to scale.
 */
export interface GeometryDiagram {
  kind: "geometry";
  /** Read out to screen-reader users in place of the picture. */
  alt: string;
  shapes: { points: Point[]; closed: boolean }[];
  labels: DiagramLabel[];
  /** A small square in the corner at `at`, between the directions to `a` and `b`. */
  rightAngles: { at: Point; a: Point; b: Point }[];
  /** An arc in the corner at `at`, between the directions to `a` and `b`. */
  arcs: { at: Point; a: Point; b: Point }[];
}

export interface Axis {
  min: number;
  max: number;
  step: number;
  label?: string;
}

/** A coordinate grid in data units, with straight lines and plotted points. */
export interface GraphDiagram {
  kind: "graph";
  alt: string;
  /** Same scale on both axes, with x and y at the ends of the axes (coordinate grids). */
  equalScale?: boolean;
  x: Axis;
  y: Axis;
  lines: { from: Point; to: Point; label?: string }[];
  points: Point[];
}

/** A vertical bar chart. */
export interface BarDiagram {
  kind: "bar";
  alt: string;
  categories: string[];
  values: number[];
  y: Axis;
  xLabel?: string;
}

export type Diagram = GeometryDiagram | GraphDiagram | BarDiagram;

const num = z.number().finite();
const point = z.tuple([num, num]);
const text = z.string().min(1).max(40);
const alt = z.string().min(10).max(500);
const axis = z
  .object({ min: num, max: num, step: num.positive(), label: text.optional() })
  .refine((a) => a.max > a.min && (a.max - a.min) / a.step <= 40, "Axis range or step is off");

export const DiagramSchema: z.ZodType<Diagram> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("geometry"),
    alt,
    shapes: z.array(z.object({ points: z.array(point).min(2), closed: z.boolean() })).min(1),
    labels: z.array(
      z.object({ at: point, text, anchor: z.enum(["start", "middle", "end"]).optional() }),
    ),
    rightAngles: z.array(z.object({ at: point, a: point, b: point })),
    arcs: z.array(z.object({ at: point, a: point, b: point })),
  }),
  z.object({
    kind: z.literal("graph"),
    alt,
    equalScale: z.boolean().optional(),
    x: axis,
    y: axis,
    lines: z.array(z.object({ from: point, to: point, label: text.optional() })),
    points: z.array(point),
  }),
  z
    .object({
      kind: z.literal("bar"),
      alt,
      categories: z.array(text).min(2).max(8),
      values: z.array(num.nonnegative()),
      y: axis,
      xLabel: text.optional(),
    })
    .refine((d) => d.values.length === d.categories.length, "One value per category")
    .refine((d) => d.values.every((v) => v <= d.y.max), "Bars fit the axis"),
]);

// ---------------------------------------------------------------------------
// Helpers for placing labels in geometry diagrams
// ---------------------------------------------------------------------------

const LABEL_GAP = 14;

function centroid(points: readonly Point[]): Point {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

function unit([x, y]: Point): Point {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

/** A label beside the side from `a` to `b`, on the side away from `inside`. */
export function sideLabel(a: Point, b: Point, text: string, inside: Point): DiagramLabel {
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let normal = unit([-(b[1] - a[1]), b[0] - a[0]]);
  const towardsInside = (inside[0] - mid[0]) * normal[0] + (inside[1] - mid[1]) * normal[1];
  if (towardsInside > 0) normal = [-normal[0], -normal[1]];
  const at: Point = [mid[0] + normal[0] * LABEL_GAP, mid[1] + normal[1] * LABEL_GAP];
  const anchor: TextAnchor = normal[0] > 0.4 ? "start" : normal[0] < -0.4 ? "end" : "middle";
  return { at, text, anchor };
}

/** A label inside the corner at `at`, between the directions to `a` and `b`. */
export function angleLabel(at: Point, a: Point, b: Point, text: string, gap = 30): DiagramLabel {
  const ua = unit([a[0] - at[0], a[1] - at[1]]);
  const ub = unit([b[0] - at[0], b[1] - at[1]]);
  let dir = unit([ua[0] + ub[0], ua[1] + ub[1]]);
  // A straight angle has no bisector from the sum: use the perpendicular
  if (Math.hypot(ua[0] + ub[0], ua[1] + ub[1]) < 1e-6) dir = [-ua[1], ua[0]];
  // Narrow corners push the label further out so it clears both lines
  const half = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]))) / 2;
  const distance = Math.min(70, Math.max(gap, 13 / Math.max(Math.sin(half), 0.01)));
  return {
    at: tidy([at[0] + dir[0] * distance, at[1] + dir[1] * distance]),
    text,
    anchor: "middle",
  };
}

/** Labels for a polygon's sides, placed outside it. `texts[i]` labels side i → i+1; null skips. */
export function polygonSideLabels(
  points: readonly Point[],
  texts: (string | null)[],
): DiagramLabel[] {
  const c = centroid(points);
  return texts.flatMap((t, i) =>
    t === null ? [] : [sideLabel(points[i]!, points[(i + 1) % points.length]!, t, c)],
  );
}

/** Rounds every coordinate, so stored diagrams stay small and stable. */
export function tidy(p: Point): Point {
  return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
}
