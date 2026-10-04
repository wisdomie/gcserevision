// Normalisation and parsing of raw answer strings (PLAN.md 6.3).
// Input may be typed text or LaTeX from MathLive. Nothing here throws.

export const MAX_ANSWER_LENGTH = 200;

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
};

/**
 * Canonical form of a raw answer: trimmed, single-spaced, ASCII minus, math
 * delimiters removed and common LaTeX noise stripped.
 */
export function normalise(raw: string): string {
  // Superscript digits become ^{...} before NFKC would flatten 10³ into "103".
  let s = raw.replace(
    /[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
    (sup) => `^{${[...sup].map((c) => SUPERSCRIPTS[c]).join("")}}`,
  );
  s = s.normalize("NFKC");
  // Unicode minus and dashes -> '-'
  s = s.replace(/[−‐-―﹣－]/g, "-");
  s = s.replace(/\s+/g, " ").trim();

  // Inline-math delimiters. Two or more unescaped $ are delimiters ($x = 2$ or
  // $x = 3$); a single $ is a currency sign and is left for parseNumber.
  if ((s.match(/(?<!\\)\$/g) ?? []).length >= 2) s = s.replace(/(?<!\\)\$/g, "");
  s = s.replace(/\\[()[\]]/g, "");

  s = s
    .replace(/\\(?:left|right)(?=[()[\]|.]|\\[{}])/g, "")
    .replace(/\\(?:quad|qquad)/g, " ")
    .replace(/\\(?:text|mathrm|textrm|mathit|operatorname)\{([^{}]*)\}/g, "$1")
    .replace(/\\[dt]frac/g, "\\frac")
    .replace(/\{,\}/g, ",") // MathLive thousands/decimal comma
    .replace(/\\[,;:!]|\\ |~/g, " ")
    .replace(/\\%/g, "%")
    .replace(/\\(?:pounds|textsterling) ?/g, "£")
    .replace(/\\\$/g, "$")
    .replace(/\\colon/g, ":")
    .replace(/\\(?:times|cdot)/g, "*")
    .replace(/×|·/g, "*");

  return s.replace(/\s+/g, " ").trim();
}

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export interface ParseNumberOptions {
  /** Allow and strip a trailing % sign. */
  percent?: boolean;
  /** A unit to allow and strip at the end, e.g. 'cm'. */
  unit?: string;
}

/**
 * Parses a plain number from a normalised string. Accepts a leading currency
 * symbol, thousands separators ("1,000" / "1 000"), and optionally a trailing
 * % or unit. Returns null if it isn't a plain number.
 */
export function parseNumber(s: string, opts: ParseNumberOptions = {}): number | null {
  let t = s.trim();
  if (opts.unit) {
    const unit = opts.unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\s*${unit}$`), "");
  }
  if (opts.percent) t = t.replace(/\s*%$/, "");

  // Currency symbol before or after the sign: £5, -£5, £-5
  t = t.replace(/^([+-]?)\s*[£$€]\s*/, "$1");

  // Thousands separators: only when every group has exactly three digits.
  if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  else if (/^[+-]?\d{1,3}(?: \d{3})+(?:\.\d+)?$/.test(t)) t = t.replace(/ /g, "");

  if (!NUMBER_RE.test(t)) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

export interface ParsedFraction {
  num: number;
  den: number;
  /** Whole-number part if written as a mixed number. */
  whole?: number;
  /** True if the input was a plain integer. */
  isInteger?: boolean;
}

const INT = "(\\d{1,9})";

/**
 * Parses a/b, \frac{a}{b}, mixed numbers (2 1/3, 2\frac{1}{3}) and integers.
 * The returned num/den carry the overall value (den > 0); `whole` is set for
 * mixed numbers. Returns null for anything else, including decimals.
 */
export function parseFraction(s: string): ParsedFraction | null {
  const t = s.replace(/\s*\/\s*/g, "/").trim();
  let match: RegExpExecArray | null;

  const signed = (neg: boolean, num: number, den: number): ParsedFraction | null => {
    if (den === 0) return null;
    if (den < 0) [num, den] = [-num, -den];
    return { num: neg ? -num : num, den };
  };

  if ((match = new RegExp(`^([+-]?)${INT}$`).exec(t))) {
    return { num: Number(match[1] + match[2]) || 0, den: 1, isInteger: true };
  }
  if ((match = new RegExp(`^([+-]?)${"\\(?"}([+-]?\\d{1,9})/([+-]?\\d{1,9})${"\\)?"}$`).exec(t))) {
    return signed(match[1] === "-", Number(match[2]), Number(match[3]));
  }
  if (
    (match = new RegExp(
      `^([+-]?)\\\\frac\\{\\s*([+-]?\\d{1,9})\\s*\\}\\{\\s*([+-]?\\d{1,9})\\s*\\}$`,
    ).exec(t))
  ) {
    return signed(match[1] === "-", Number(match[2]), Number(match[3]));
  }
  // \frac12 shorthand (single digits)
  if ((match = /^([+-]?)\\frac(\d)(\d)$/.exec(t))) {
    return signed(match[1] === "-", Number(match[2]), Number(match[3]));
  }

  const mixed =
    new RegExp(`^([+-]?)${INT} ${INT}/${INT}$`).exec(t) ??
    new RegExp(`^([+-]?)${INT}\\s*\\\\frac(\\d)(\\d)$`).exec(t) ??
    new RegExp(`^([+-]?)${INT}\\s*\\\\frac\\{\\s*${INT}\\s*\\}\\{\\s*${INT}\\s*\\}$`).exec(t);
  if (mixed) {
    const whole = Number(mixed[2]);
    const n = Number(mixed[3]);
    const d = Number(mixed[4]);
    if (d === 0) return null;
    const neg = mixed[1] === "-";
    const num = whole * d + n;
    return { num: neg ? -num : num, den: d, whole: neg ? -whole : whole };
  }
  return null;
}

/**
 * Parses a number or a fraction (3/4, \frac{3}{4}, 1 1/2) to its value.
 * Returns null otherwise.
 */
export function parseValue(s: string): number | null {
  const x = parseNumber(s);
  if (x !== null) return x;
  const f = parseFraction(s);
  return f ? f.num / f.den : null;
}

/**
 * Splits a list of solutions such as "x = 2 or x = -3", "2, -3" or "-3 and 2".
 * Each item has an optional "x =" prefix. Returns null if any item is
 * unreadable or names a different variable.
 */
export function parseSolutions(s: string, variable: string): number[] | null {
  const items = s
    .split(/\s*(?:,|;|\bor\b|\band\b|\\lor)\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  const values: number[] = [];
  for (const item of items) {
    const m = /^([a-zA-Z])(?:_\{?\d\}?)?\s*=\s*(.+)$/.exec(item);
    if (m && m[1] !== variable) return null;
    const value = parseValue(m ? m[2] : item);
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

/** Parses "a : b" or "a : b : c" into its parts. */
export function parseRatio(s: string): number[] | null {
  const parts = s.split(":").map((t) => parseValue(t.trim()));
  if (parts.length < 2 || parts.some((p) => p === null)) return null;
  return parts as number[];
}

/** Parses a × 10^n, a*10^{n}, a x 10^n or aEn into mantissa and exponent. */
export function parseStandardForm(s: string): { mantissa: number; exponent: number } | null {
  const m =
    /^([+-]?\d+(?:\.\d+)?)\s*(?:\*|x|X)\s*10\s*\^\s*(?:\{\s*([+-]?\d{1,3})\s*\}|([+-]?\d{1,3}))$/.exec(
      s,
    ) ?? /^([+-]?\d+(?:\.\d+)?)[eE]([+-]?\d{1,3})$/.exec(s);
  if (!m) return null;
  return { mantissa: Number(m[1]), exponent: Number(m[2] ?? m[3]) };
}
