import { angleLabel, tidy, type GeometryDiagram, type Point } from "../../diagram";
import type { GeneratedQuestion, QuestionGenerator, Rng } from "../../types";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

const deg = (x: number) => `${x}°`;
const rad = (d: number) => (d * Math.PI) / 180;
const ray = (from: Point, angle: number, length: number): Point =>
  tidy([from[0] + length * Math.cos(rad(angle)), from[1] + length * Math.sin(rad(angle))]);

function answer(x: number, steps: string[], promptMd: string, diagram: GeometryDiagram) {
  return {
    promptMd,
    inputType: "numeric",
    diagram,
    answerSpec: { kind: "decimal", value: x, unit: "°" },
    solution: { steps, final: deg(x) },
  } satisfies GeneratedQuestion;
}

const PROMPT = `Work out the size of the angle marked ${m("x")}.`;

function triangle(rng: Rng): GeneratedQuestion {
  return retry(() => {
    const a = rng.int(25, 110);
    const b = rng.int(25, 110);
    const x = 180 - a - b;
    if (x < 25 || x === a || x === b) return null;

    // Draw it close to the real shape: base of 200, apex from the two base angles
    const base = 200;
    const apexX = (base * Math.tan(rad(b))) / (Math.tan(rad(a)) + Math.tan(rad(b)));
    const height = apexX * Math.tan(rad(a));
    if (!Number.isFinite(height) || height > 260 || height < 40) return null;
    const P: Point = [0, 0];
    const Q: Point = [base, 0];
    const R: Point = tidy([apexX, height]);

    const diagram: GeometryDiagram = {
      kind: "geometry",
      alt: `A triangle. Two of its angles are ${a} degrees and ${b} degrees. The third angle is marked x.`,
      shapes: [{ points: [P, Q, R], closed: true }],
      labels: [
        angleLabel(P, Q, R, deg(a), 28),
        angleLabel(Q, R, P, deg(b), 28),
        angleLabel(R, P, Q, "x", 26),
      ],
      rightAngles: [],
      arcs: [],
    };
    return answer(
      x,
      [
        `The angles in a triangle add up to ${m("180°")}.`,
        `${m("x = 180 - " + a + " - " + b + " = " + x)}°`,
      ],
      PROMPT,
      diagram,
    );
  });
}

/** Angles that fill a straight line (180°) or go all the way round a point (360°). */
function aroundPoint(rng: Rng, total: 180 | 360): GeneratedQuestion {
  return retry(() => {
    const parts = total === 180 ? rng.int(2, 3) : rng.int(3, 4);
    const known = Array.from({ length: parts - 1 }, () => rng.int(total === 180 ? 25 : 40, 140));
    const x = total - known.reduce((s, k) => s + k, 0);
    if (x < (total === 180 ? 25 : 40) || x > 160 || known.includes(x)) return null;

    const angles = rng.shuffle([
      ...known.map((k) => ({ size: k, text: deg(k) })),
      { size: x, text: "x" },
    ]);
    const O: Point = [0, 0];
    const length = 110;
    const start = total === 180 ? 0 : rng.int(0, 89);
    let at = start;
    const rays: Point[] = [ray(O, at, length)];
    for (const a of angles) {
      at += a.size;
      rays.push(ray(O, at, length));
    }
    const labels = angles.map((a, i) => angleLabel(O, rays[i]!, rays[i + 1]!, a.text, 36));

    const knownList = known.join(" - ");
    const diagram: GeometryDiagram = {
      kind: "geometry",
      alt:
        total === 180
          ? `Angles on a straight line: ${known.map((k) => `${k} degrees`).join(", ")} and an angle marked x.`
          : `Angles around a point: ${known.map((k) => `${k} degrees`).join(", ")} and an angle marked x.`,
      shapes:
        total === 180
          ? [
              { points: [ray(O, 180, length), ray(O, 0, length)], closed: false },
              ...rays.slice(1, -1).map((r) => ({ points: [O, r], closed: false })),
            ]
          : rays.slice(0, -1).map((r) => ({ points: [O, r], closed: false })),
      labels,
      rightAngles: [],
      arcs: angles.map((_, i) => ({ at: O, a: rays[i]!, b: rays[i + 1]! })),
    };
    return answer(
      x,
      [
        total === 180
          ? `Angles on a straight line add up to ${m("180°")}.`
          : `Angles around a point add up to ${m("360°")}.`,
        `${m(`x = ${total} - ${knownList} = ${x}`)}°`,
      ],
      PROMPT,
      diagram,
    );
  });
}

export const missingAngle: QuestionGenerator = {
  key: "geometry.angles.missing",
  topicSlug: "angles",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 1,
  boards: "all",
  needsDiagram: true,
  generate(rng) {
    const r = rng.next();
    if (r < 0.4) return triangle(rng);
    return aroundPoint(rng, r < 0.7 ? 180 : 360);
  },
};
