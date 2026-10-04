// LaTeX helpers for algebraic expressions with integer coefficients.

/** A term like "3x", "-x", "x" or "" (for coefficient 0). */
export function term(coef: number, variable: string): string {
  if (coef === 0) return "";
  if (coef === 1) return variable;
  if (coef === -1) return `-${variable}`;
  return `${coef}${variable}`;
}

/**
 * Joins signed terms into an expression: ["3x", "-5"] -> "3x - 5".
 * Empty terms are skipped; an empty result becomes "0".
 */
export function joinTerms(terms: string[]): string {
  const parts = terms.filter(Boolean);
  if (parts.length === 0) return "0";
  return parts
    .map((t, i) => {
      if (i === 0) return t;
      return t.startsWith("-") ? `- ${t.slice(1)}` : `+ ${t}`;
    })
    .join(" ");
}

/** ax + b as LaTeX, e.g. linear(3, "x", -5) -> "3x - 5". */
export function linear(a: number, variable: string, b: number): string {
  return joinTerms([term(a, variable), b === 0 ? "" : `${b}`]);
}

/** Wraps negative numbers in brackets for substitution: -3 -> "(-3)". */
export function paren(n: number): string {
  return n < 0 ? `(${n})` : `${n}`;
}

/** "+ 3" or "- 3", for showing an operation applied to both sides. */
export function signed(n: number): string {
  return n < 0 ? `- ${-n}` : `+ ${n}`;
}
