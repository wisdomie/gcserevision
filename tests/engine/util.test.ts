import { describe, expect, it } from "vitest";
import {
  factorised,
  fmt,
  fmtFixed,
  fmtMoney,
  latexFrac,
  latexPrimeFactors,
  m,
} from "@/lib/engine/util/format";
import {
  approxEqual,
  clean,
  decimalsForSf,
  gcd,
  lcm,
  magnitude,
  primeFactors,
  roundDp,
  roundSf,
} from "@/lib/engine/util/numbers";
import { retry } from "@/lib/engine/util/retry";

describe("numbers", () => {
  it("gcd and lcm", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(-12, 18)).toBe(6);
    expect(gcd(7, 0)).toBe(7);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(0, 6)).toBe(0);
  });
  it("primeFactors", () => {
    expect(primeFactors(360)).toEqual([
      [2, 3],
      [3, 2],
      [5, 1],
    ]);
    expect(primeFactors(97)).toEqual([[97, 1]]);
    expect(() => primeFactors(1)).toThrow(RangeError);
    expect(() => primeFactors(2.5)).toThrow(RangeError);
  });
  it("roundDp avoids floating-point surprises and rounds halves away from zero", () => {
    expect(roundDp(1.005, 2)).toBe(1.01);
    expect(roundDp(2.345, 2)).toBe(2.35);
    expect(roundDp(-2.5, 0)).toBe(-3);
    expect(roundDp(4523, -2)).toBe(4500);
    expect(roundDp(4550, -2)).toBe(4600);
  });
  it("roundSf", () => {
    expect(roundSf(45678, 2)).toBe(46000);
    expect(roundSf(0.0034567, 3)).toBe(0.00346);
    expect(roundSf(9.96, 2)).toBe(10);
    expect(roundSf(0, 3)).toBe(0);
    expect(roundSf(-0.0561, 1)).toBe(-0.06);
  });
  it("magnitude and decimalsForSf", () => {
    expect(magnitude(1)).toBe(0);
    expect(magnitude(999)).toBe(2);
    expect(magnitude(0.001)).toBe(-3);
    expect(decimalsForSf(0.00346, 3)).toBe(5);
    expect(decimalsForSf(46000, 2)).toBe(0);
    expect(decimalsForSf(10, 3)).toBe(1);
    expect(decimalsForSf(0, 3)).toBe(2);
  });
  it("clean and approxEqual", () => {
    expect(clean(0.1 + 0.2)).toBe(0.3);
    expect(approxEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(approxEqual(1, 1.001)).toBe(false);
  });
});

describe("format", () => {
  it("latexFrac puts the sign in front", () => {
    expect(latexFrac(3, 4)).toBe("\\frac{3}{4}");
    expect(latexFrac(-3, 4)).toBe("-\\frac{3}{4}");
    expect(latexFrac(3, -4)).toBe("-\\frac{3}{4}");
    expect(latexFrac(-3, -4)).toBe("\\frac{3}{4}");
  });
  it("fmt shows plain numbers without noise or exponents", () => {
    expect(fmt(0.1 + 0.2)).toBe("0.3");
    expect(fmt(-0)).toBe("0");
    expect(fmt(0.0000005)).toBe("0.0000005");
    expect(fmt(1234)).toBe("1234");
  });
  it("fmtFixed keeps trailing zeros and never shows -0", () => {
    expect(fmtFixed(3, 1)).toBe("3.0");
    expect(fmtFixed(-0.0001, 2)).toBe("0.00");
    expect(fmtFixed(2.5, 0)).toBe("3");
  });
  it("fmtMoney", () => {
    expect(fmtMoney(12)).toBe("£12");
    expect(fmtMoney(12.5)).toBe("£12.50");
  });
  it("latexPrimeFactors and m", () => {
    expect(latexPrimeFactors(360)).toBe("2^{3} \\times 3^{2} \\times 5");
    expect(m("x")).toBe("$x$");
    expect(factorised(12)).toBe("$12 = 2^{2} \\times 3$");
    expect(factorised(11)).toBe("$11$ is prime");
  });
});

describe("retry", () => {
  it("returns the first non-null result", () => {
    let i = 0;
    expect(retry(() => (++i === 3 ? "ok" : null))).toBe("ok");
  });
  it("gives up after the limit", () => {
    expect(() => retry(() => null, 5)).toThrow(/5 attempts/);
  });
});
