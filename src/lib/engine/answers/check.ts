// Server-side answer checker (PLAN.md 6.3). Pure: no I/O, never throws.

import type { AnswerSpec, CheckResult } from "../types";
import { approxEqual, gcd, roundDp, roundSf } from "../util/numbers";
import {
  MAX_ANSWER_LENGTH,
  normalise,
  parseFraction,
  parseNumber,
  parseRatio,
  parseSolutions,
  parseStandardForm,
} from "./normalise";
import {
  equivalent,
  isExpanded,
  isFactorised,
  isSimplified,
  parseExpression,
  stripSubject,
} from "./expression";

export const FEEDBACK = {
  unreadable: "Could not read your answer",
  simplify: "Simplify your answer",
  fraction: "Give your answer as a fraction",
  rounding: "Check your rounding",
  standardForm: "Give your answer in standard form",
  extra: "Check how many solutions you have given",
  expand: "Expand the brackets and simplify fully",
  factorise: "Factorise your answer fully",
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
    if (spec.kind === "multi") return checkMulti(spec, raw, marks);
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

    case "solutions": {
      const values = parseSolutions(s, spec.variable);
      if (!values) return wrong(FEEDBACK.unreadable);
      if (values.length !== spec.values.length) {
        const allRight = values.every((v) => spec.values.some((e) => approxEqual(v, e)));
        return wrong(allRight ? FEEDBACK.extra : undefined);
      }
      const remaining = [...spec.values];
      for (const v of values) {
        const i = remaining.findIndex((e) => approxEqual(v, e));
        if (i === -1) return wrong();
        remaining.splice(i, 1);
      }
      return right(marks);
    }

    case "ratio": {
      const parts = parseRatio(s);
      if (!parts) return wrong(FEEDBACK.unreadable);
      if (parts.length !== spec.parts.length) return wrong();
      if (parts.every((p, i) => approxEqual(p, spec.parts[i]))) return right(marks);
      // Same proportions but not simplified
      const k = parts[0] / spec.parts[0];
      if (k > 0 && parts.every((p, i) => approxEqual(p, spec.parts[i] * k)))
        return wrong(FEEDBACK.simplify);
      return wrong();
    }

    case "standardForm": {
      const expected = spec.mantissa * 10 ** spec.exponent;
      const sf = parseStandardForm(s);
      if (!sf) {
        const x = parseNumber(s);
        if (x !== null && approxEqual(x, expected)) return wrong(FEEDBACK.standardForm);
        return x === null ? wrong(FEEDBACK.unreadable) : wrong();
      }
      const valueMatches = approxEqual(sf.mantissa * 10 ** sf.exponent, expected);
      const isStandard = Math.abs(sf.mantissa) >= 1 && Math.abs(sf.mantissa) < 10;
      if (valueMatches && isStandard && sf.exponent === spec.exponent) return right(marks);
      return wrong(valueMatches ? FEEDBACK.standardForm : undefined);
    }

    case "expression": {
      const answer = parseExpression(stripSubject(s));
      const reference = parseExpression(spec.latex);
      if (!answer) return wrong(FEEDBACK.unreadable);
      if (!reference || !equivalent(answer, reference)) return wrong();
      const form = spec.form ?? "any";
      if (form === "expanded" && !isExpanded(answer)) return wrong(FEEDBACK.expand);
      if (form === "factorised" && !isFactorised(answer)) return wrong(FEEDBACK.factorise);
      if (form === "simplified" && !isSimplified(answer)) return wrong(FEEDBACK.simplify);
      return right(marks);
    }

    case "multi":
      // Handled before normalisation in check().
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

/** Splits `marks` across parts: explicit marksPerPart, or as evenly as possible (earlier parts get the spare). */
export function marksForParts(count: number, marks: number, marksPerPart?: number[]): number[] {
  if (marksPerPart && marksPerPart.length === count) return marksPerPart;
  const base = Math.floor(marks / count);
  return Array.from({ length: count }, (_, i) => base + (i < marks % count ? 1 : 0));
}

/** Multi-part answers arrive as a JSON array of strings, one per part. */
function checkMulti(
  spec: Extract<AnswerSpec, { kind: "multi" }>,
  raw: string,
  marks: number,
): CheckResult {
  let answers: unknown;
  try {
    answers = JSON.parse(raw);
  } catch {
    return wrong(FEEDBACK.unreadable);
  }
  if (
    !Array.isArray(answers) ||
    answers.length !== spec.parts.length ||
    !answers.every((a) => typeof a === "string")
  ) {
    return wrong(FEEDBACK.unreadable);
  }
  const partMarks = marksForParts(spec.parts.length, marks, spec.marksPerPart);
  const results = spec.parts.map((part, i) => check(part.spec, answers[i] as string, partMarks[i]));
  const awarded = results.reduce((sum, r) => sum + r.marksAwarded, 0);
  const rightParts = results.filter((r) => r.correct).length;
  if (rightParts === results.length) return right(awarded);
  return {
    correct: false,
    marksAwarded: awarded,
    feedback: `${rightParts} of ${results.length} parts correct`,
  };
}
