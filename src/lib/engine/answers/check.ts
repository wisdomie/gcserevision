// Server-side answer checker (PLAN.md 6.3). Pure: no I/O, never throws.

import type { AnswerSpec, CheckResult } from "../types";
import { approxEqual, gcd, roundDp, roundSf } from "../util/numbers";
import { MAX_ANSWER_LENGTH, normalise, parseFraction, parseNumber } from "./normalise";

export const FEEDBACK = {
  unreadable: "Could not read your answer",
  simplify: "Simplify your answer",
  fraction: "Give your answer as a fraction",
  rounding: "Check your rounding",
  unsupported: "This answer type can't be marked yet",
} as const;

const wrong = (feedback?: string): CheckResult =>
  feedback ? { correct: false, marksAwarded: 0, feedback } : { correct: false, marksAwarded: 0 };

const right = (marks: number): CheckResult => ({ correct: true, marksAwarded: marks });

/**
 * Marks a raw answer against a spec. `marks` is the question's total; a
 * single-part answer earns all of it or nothing.
 */
export function check(spec: AnswerSpec, raw: string, marks = 1): CheckResult {
  try {
    if (typeof raw !== "string" || raw.length > MAX_ANSWER_LENGTH)
      return wrong(FEEDBACK.unreadable);
    const s = normalise(raw);
    if (!s) return wrong(FEEDBACK.unreadable);
    return checkNormalised(spec, s, marks);
  } catch {
    return wrong(FEEDBACK.unreadable);
  }
}

function checkNormalised(spec: AnswerSpec, s: string, marks: number): CheckResult {
  switch (spec.kind) {
    case "mcq": {
      if (!/^\d{1,2}$/.test(s)) return wrong(FEEDBACK.unreadable);
      return Number(s) === spec.correctIndex ? right(marks) : wrong();
    }

    case "integer": {
      const x = parseNumber(s);
      if (x === null) return wrong(FEEDBACK.unreadable);
      return x === spec.value ? right(marks) : wrong();
    }

    case "percentage": {
      const x = parseNumber(s, { percent: true });
      if (x === null) return wrong(FEEDBACK.unreadable);
      return approxEqual(x, spec.value) ? right(marks) : wrong();
    }

    case "decimal": {
      const x = parseNumber(s, { unit: spec.unit });
      if (x === null) return wrong(FEEDBACK.unreadable);

      const expected =
        spec.dp !== undefined
          ? roundDp(spec.value, spec.dp)
          : spec.sf !== undefined
            ? roundSf(spec.value, spec.sf)
            : spec.value;

      const ok =
        spec.tolerance !== undefined
          ? Math.abs(x - expected) <= spec.tolerance + 1e-12
          : approxEqual(x, expected);
      if (ok) return right(marks);
      // The right number rounded to the wrong precision (or not rounded at all)
      if ((spec.dp !== undefined || spec.sf !== undefined) && isRoundingOf(spec.value, x)) {
        return wrong(FEEDBACK.rounding);
      }
      return wrong();
    }

    case "fraction": {
      const f = parseFraction(s);
      if (!f) {
        return parseNumber(s) !== null ? wrong(FEEDBACK.fraction) : wrong(FEEDBACK.unreadable);
      }
      if (f.whole !== undefined && !spec.allowMixed) return wrong(FEEDBACK.fraction);

      const equal = f.num * spec.den === spec.num * f.den;
      if (!equal) return wrong();

      if (spec.mustBeSimplest) {
        const fracNum = f.whole !== undefined ? Math.abs(f.num) - Math.abs(f.whole) * f.den : f.num;
        const improperInMixed = f.whole !== undefined && fracNum >= f.den;
        if (gcd(fracNum, f.den) !== 1 || improperInMixed) return wrong(FEEDBACK.simplify);
      }
      return right(marks);
    }

    case "expression":
    case "solutions":
    case "ratio":
    case "standardForm":
    case "multi":
      // Implemented in M3.
      return wrong(FEEDBACK.unsupported);
  }
}

/** True if `x` is `value` itself or `value` rounded to some number of places. */
function isRoundingOf(value: number, x: number): boolean {
  if (approxEqual(x, value)) return true;
  for (let dp = -6; dp <= 10; dp++) {
    if (approxEqual(x, roundDp(value, dp))) return true;
  }
  return false;
}
