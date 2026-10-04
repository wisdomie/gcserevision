// Pure number helpers shared by the answer checker and generators.

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

/** Prime factorisation as [prime, exponent] pairs in ascending order. n must be an integer >= 2. */
export function primeFactors(n: number): [number, number][] {
  if (!Number.isInteger(n) || n < 2) throw new RangeError(`primeFactors: invalid n ${n}`);
  const out: [number, number][] = [];
  for (let p = 2; p * p <= n; p++) {
    let e = 0;
    while (n % p === 0) {
      n /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (n > 1) out.push([n, 1]);
  return out;
}

/** Removes binary floating-point noise, e.g. 0.1 + 0.2 -> 0.3. */
export function clean(x: number): number {
  return Number(x.toPrecision(15));
}

/** Round half away from zero to `dp` decimal places (dp may be negative: -1 = nearest 10). */
export function roundDp(x: number, dp: number): number {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  if (dp >= 0) {
    const f = 10 ** dp;
    return clean((sign * Math.round(clean(abs * f))) / f);
  }
  const f = 10 ** -dp;
  return clean(sign * Math.round(clean(abs / f)) * f);
}

/** Position of the leading digit: 0 for 1–9.99, 2 for 100–999, -3 for 0.001–0.00999. */
export function magnitude(x: number): number {
  return Math.floor(Math.log10(Math.abs(clean(x))));
}

/** Round half away from zero to `sf` significant figures. */
export function roundSf(x: number, sf: number): number {
  if (x === 0) return 0;
  return roundDp(x, sf - 1 - magnitude(x));
}

/** Number of decimal places needed to show `x` rounded to `sf` significant figures. */
export function decimalsForSf(x: number, sf: number): number {
  if (x === 0) return Math.max(0, sf - 1);
  return Math.max(0, sf - 1 - magnitude(x));
}

/** Equal within a relative tolerance, for comparing parsed answers. */
export function approxEqual(a: number, b: number, rel = 1e-9): boolean {
  return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
}
