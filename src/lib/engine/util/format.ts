// Formatting helpers that produce markdown + LaTeX strings.

import { clean, primeFactors } from "./numbers";

/** A fraction as LaTeX, with the sign in front: -\frac{1}{2}. */
export function latexFrac(num: number, den: number): string {
  const sign = num * den < 0 ? "-" : "";
  return `${sign}\\frac{${Math.abs(num)}}{${Math.abs(den)}}`;
}

/** A plain number without floating-point noise or exponent notation. */
export function fmt(x: number): string {
  const c = clean(x);
  if (Object.is(c, -0)) return "0";
  if (Math.abs(c) >= 1e-6 && Math.abs(c) < 1e21) return String(c);
  return c.toFixed(12).replace(/\.?0+$/, "");
}

/** A number shown to exactly `dp` decimal places (keeps trailing zeros). */
export function fmtFixed(x: number, dp: number): string {
  const s = clean(x).toFixed(dp);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
}

/** Money with £: whole pounds stay whole, otherwise 2 dp. */
export function fmtMoney(x: number): string {
  const c = clean(x);
  return `£${Number.isInteger(c) ? String(c) : fmtFixed(c, 2)}`;
}

/** Prime factorisation as LaTeX in index form, e.g. 2^{3} \times 3 \times 5^{2}. */
export function latexPrimeFactors(n: number): string {
  return primeFactors(n)
    .map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`))
    .join(" \\times ");
}

/** Wraps LaTeX in inline-math delimiters. */
export const m = (latex: string) => `$${latex}$`;

/** "$12 = 2^{2} \\times 3$", or "$11$ is prime". */
export function factorised(n: number): string {
  const f = latexPrimeFactors(n);
  return f === `${n}` ? `${m(f)} is prime` : m(`${n} = ${f}`);
}
