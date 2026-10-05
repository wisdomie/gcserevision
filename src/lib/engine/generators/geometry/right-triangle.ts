// Shared drawing for right-angled triangle questions (Pythagoras and trigonometry).
import {
  angleLabel,
  sideLabel,
  tidy,
  type DiagramLabel,
  type GeometryDiagram,
  type Point,
} from "../../diagram";
import type { Rng } from "../../types";

export interface RightTriangleLabels {
  /** The horizontal side (adjacent to the angle at A). */
  base: string | null;
  /** The vertical side (opposite the angle at A). */
  height: string | null;
  hypotenuse: string | null;
  /** A label for the angle at A, the far end of the base. */
  angle?: string;
}

/**
 * A right-angled triangle with the right angle at C, base CA and height CB,
 * drawn with the real proportions (longest side 200 units). Mirrored at random.
 */
export function rightTriangle(
  rng: Rng,
  baseLength: number,
  heightLength: number,
  labels: RightTriangleLabels,
  alt: string,
): GeometryDiagram {
  const scale = 200 / Math.max(baseLength, heightLength);
  const w = baseLength * scale;
  const h = heightLength * scale;
  const mirror = rng.next() < 0.5;
  const C: Point = [mirror ? w : 0, 0];
  const A: Point = tidy([mirror ? 0 : w, 0]);
  const B: Point = tidy([C[0], h]);
  const inside: Point = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];

  const sideLabels = [
    labels.base && sideLabel(C, A, labels.base, inside),
    labels.height && sideLabel(C, B, labels.height, inside),
    labels.hypotenuse && sideLabel(A, B, labels.hypotenuse, inside),
  ].filter((l): l is DiagramLabel => Boolean(l));

  return {
    kind: "geometry",
    alt,
    shapes: [{ points: [C, A, B], closed: true }],
    labels: [...sideLabels, ...(labels.angle ? [angleLabel(A, B, C, labels.angle, 40)] : [])],
    rightAngles: [{ at: C, a: A, b: B }],
    arcs: labels.angle ? [{ at: A, a: B, b: C }] : [],
  };
}

/** Rejects draws too long and thin to read. */
export const readableRatio = (a: number, b: number) => Math.max(a, b) / Math.min(a, b) <= 3;
