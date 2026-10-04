import { describe, expect, it } from "vitest";
import { check, FEEDBACK } from "@/lib/engine/answers/check";
import {
  normalise,
  parseFraction,
  parseNumber,
  parseRatio,
  parseSolutions,
  parseStandardForm,
  parseValue,
} from "@/lib/engine/answers/normalise";
import type { AnswerSpec } from "@/lib/engine/types";

const ok = (spec: AnswerSpec, raw: string) =>
  expect(check(spec, raw).correct, `${JSON.stringify(raw)}`).toBe(true);
const no = (spec: AnswerSpec, raw: string, feedback?: string) => {
  const r = check(spec, raw);
  expect(r.correct, JSON.stringify(raw)).toBe(false);
  expect(r.marksAwarded).toBe(0);
  if (feedback) expect(r.feedback).toBe(feedback);
};

const half: AnswerSpec = { kind: "fraction", num: 1, den: 2, mustBeSimplest: true };
const halfAny: AnswerSpec = { kind: "fraction", num: 1, den: 2, mustBeSimplest: false };
const pi2dp: AnswerSpec = { kind: "decimal", value: 3.14, dp: 2 };
const minus7: AnswerSpec = { kind: "integer", value: -7 };
const thousand: AnswerSpec = { kind: "integer", value: 1000 };

// PLAN.md 6.3 required cases for the kinds implemented in M1
describe("PLAN.md 6.3 table", () => {
  it("fraction 1/2 simplest: 1/2 and \\frac{1}{2} are correct", () => {
    ok(half, "1/2");
    ok(half, "\\frac{1}{2}");
  });
  it("fraction 1/2 simplest: 2/4 is wrong with 'Simplify' feedback", () =>
    no(half, "2/4", FEEDBACK.simplify));
  it("fraction 1/2 not required simplest: 2/4 is correct", () => ok(halfAny, "2/4"));
  it("fraction 1/2: 0.5 is wrong (decimal not allowed)", () => {
    no(half, "0.5", FEEDBACK.fraction);
    no(halfAny, "0.5", FEEDBACK.fraction);
  });
  it("decimal 3.14 (2 dp): 3.14 and 3.140 are correct", () => {
    ok(pi2dp, "3.14");
    ok(pi2dp, "3.140");
  });
  it("decimal 3.14 (2 dp): 3.1 and 3.142 are wrong", () => {
    no(pi2dp, "3.1");
    no(pi2dp, "3.142");
  });
  it("integer -7: −7, -7 and ' -7 ' are correct", () => {
    ok(minus7, "−7");
    ok(minus7, "-7");
    ok(minus7, " -7 ");
  });
  it("integer 1000: 1,000 is correct", () => ok(thousand, "1,000"));
  it('garbage ("", abc, 1/0) is wrong and never throws', () => {
    const specs: AnswerSpec[] = [
      half,
      pi2dp,
      minus7,
      thousand,
      { kind: "percentage", value: 5 },
      { kind: "mcq", correctIndex: 0 },
    ];
    for (const spec of specs) {
      for (const raw of [
        "",
        "abc",
        "1/0",
        "   ",
        "\\frac{1}{0}",
        "--5",
        "1..2",
        "NaN",
        "Infinity",
        "1e999",
      ]) {
        expect(() => check(spec, raw)).not.toThrow();
        no(spec, raw);
      }
    }
  });
});

describe("normalise", () => {
  it("handles minus signs, whitespace and delimiters", () => {
    expect(normalise("  \u2212 5  ")).toBe("- 5");
    expect(normalise("$\\frac{3}{4}$")).toBe("\\frac{3}{4}");
    expect(normalise("$$12$$")).toBe("12");
    expect(normalise("\\(7\\)")).toBe("7");
    expect(normalise("\\dfrac{1}{2}")).toBe("\\frac{1}{2}");
    expect(normalise("3\\times 4")).toBe("3* 4");
    expect(normalise("12{,}500")).toBe("12,500");
    expect(normalise("\\text{cm}")).toBe("cm");
    expect(normalise("\\left(1/2\\right)")).toBe("(1/2)");
    expect(normalise("\\pounds 5")).toBe("£5");
    expect(normalise("25\\%")).toBe("25%");
  });
});

describe("parseNumber", () => {
  it.each([
    ["12", 12],
    ["-3.5", -3.5],
    ["+4", 4],
    [".5", 0.5],
    ["5.", 5],
    ["£12.50", 12.5],
    ["-£3", -3],
    ["$7", 7],
    ["1,234,567.5", 1234567.5],
    ["12 500", 12500],
  ])("%s -> %d", (s, x) => expect(parseNumber(s)).toBe(x));

  it.each(["1,23", "12,5000", "abc", "1/2", "", "1 2 3 4", "3e5", "--1"])("rejects %s", (s) =>
    expect(parseNumber(s)).toBeNull(),
  );

  it("strips % and units only when asked", () => {
    expect(parseNumber("25%")).toBeNull();
    expect(parseNumber("25%", { percent: true })).toBe(25);
    expect(parseNumber("12 cm", { unit: "cm" })).toBe(12);
    expect(parseNumber("12cm", { unit: "cm" })).toBe(12);
    expect(parseNumber("12 cm")).toBeNull();
    expect(parseNumber("12 m^2", { unit: "m^2" })).toBe(12);
  });
});

describe("parseFraction", () => {
  it.each([
    ["3/4", { num: 3, den: 4 }],
    ["-3/4", { num: -3, den: 4 }],
    ["3/-4", { num: -3, den: 4 }],
    ["-3/-4", { num: 3, den: 4 }],
    ["3 / 4", { num: 3, den: 4 }],
    ["(3/4)", { num: 3, den: 4 }],
    ["\\frac{3}{4}", { num: 3, den: 4 }],
    ["-\\frac{3}{4}", { num: -3, den: 4 }],
    ["\\frac{-3}{4}", { num: -3, den: 4 }],
    ["\\frac34", { num: 3, den: 4 }],
    ["5", { num: 5, den: 1, isInteger: true }],
    ["2 1/3", { num: 7, den: 3, whole: 2 }],
    ["-2 1/3", { num: -7, den: 3, whole: -2 }],
    ["2\\frac{1}{3}", { num: 7, den: 3, whole: 2 }],
  ])("%s", (s, expected) => expect(parseFraction(s)).toEqual(expected));

  it.each(["0.5", "1/0", "\\frac{1}{0}", "2 1/0", "a/b", "1/2/3", ""])("rejects %s", (s) =>
    expect(parseFraction(s)).toBeNull(),
  );
});

describe("fraction", () => {
  const sevenThirds: AnswerSpec = {
    kind: "fraction",
    num: 7,
    den: 3,
    mustBeSimplest: true,
    allowMixed: true,
  };
  const sevenThirdsNoMixed: AnswerSpec = { kind: "fraction", num: 7, den: 3, mustBeSimplest: true };
  const negHalf: AnswerSpec = { kind: "fraction", num: -1, den: 2, mustBeSimplest: true };

  it("accepts improper and mixed forms when mixed is allowed", () => {
    ok(sevenThirds, "7/3");
    ok(sevenThirds, "2 1/3");
    ok(sevenThirds, "2\\frac{1}{3}");
    ok(sevenThirds, "$\\frac{7}{3}$");
  });
  it("rejects a mixed number when not allowed", () => {
    ok(sevenThirdsNoMixed, "7/3");
    no(sevenThirdsNoMixed, "2 1/3", FEEDBACK.fraction);
  });
  it("needs the fractional part of a mixed number simplified", () => {
    no(sevenThirds, "2 2/6", FEEDBACK.simplify);
    no(sevenThirds, "14/6", FEEDBACK.simplify);
    no(sevenThirds, "1 4/3", FEEDBACK.simplify);
  });
  it("handles negative fractions", () => {
    ok(negHalf, "-1/2");
    ok(negHalf, "1/-2");
    ok(negHalf, "-\\frac{1}{2}");
    no(negHalf, "1/2");
    no(negHalf, "-2/4", FEEDBACK.simplify);
  });
  it("accepts a whole number when the answer is whole", () => {
    ok({ kind: "fraction", num: 3, den: 1, mustBeSimplest: true }, "3");
    ok({ kind: "fraction", num: 3, den: 1, mustBeSimplest: false }, "6/2");
    no({ kind: "fraction", num: 3, den: 1, mustBeSimplest: true }, "6/2", FEEDBACK.simplify);
  });
  it("rejects wrong values without feedback", () => {
    const r = check(half, "1/3");
    expect(r).toEqual({ correct: false, marksAwarded: 0 });
  });
  it("gives 'could not read' for nonsense", () => no(half, "half", FEEDBACK.unreadable));
});

describe("integer", () => {
  it("accepts equivalent numeric forms", () => {
    ok({ kind: "integer", value: 84 }, "£84");
    ok({ kind: "integer", value: 84 }, "84.00");
    ok({ kind: "integer", value: 12500 }, "12 500");
    ok({ kind: "integer", value: 12500 }, "12{,}500");
    ok({ kind: "integer", value: 0 }, "-0");
  });
  it("rejects wrong values", () => {
    no({ kind: "integer", value: 84 }, "85");
    no({ kind: "integer", value: 84 }, "84.1");
    no({ kind: "integer", value: 84 }, "84 kg", FEEDBACK.unreadable);
  });
});

describe("decimal", () => {
  it("rounds the spec value to dp", () => {
    ok({ kind: "decimal", value: 3.14159, dp: 2 }, "3.14");
    ok({ kind: "decimal", value: 2.345, dp: 2 }, "2.35"); // half rounds up, no float error
    ok({ kind: "decimal", value: 2.96, dp: 1 }, "3.0");
    ok({ kind: "decimal", value: 2.96, dp: 1 }, "3");
    ok({ kind: "decimal", value: -2.345, dp: 2 }, "-2.35");
  });
  it("flags wrong rounding of the right number", () => {
    no({ kind: "decimal", value: 3.14159, dp: 2 }, "3.14159", FEEDBACK.rounding);
    no({ kind: "decimal", value: 3.14159, dp: 2 }, "3.1", FEEDBACK.rounding);
    no({ kind: "decimal", value: 3.14159, dp: 2 }, "3.15");
    no({ kind: "decimal", value: 3.14159, dp: 2 }, "7");
  });
  it("rounds to significant figures", () => {
    const sf: AnswerSpec = { kind: "decimal", value: 45678, sf: 2 };
    ok(sf, "46000");
    ok(sf, "46,000");
    no(sf, "45678", FEEDBACK.rounding);
    no(sf, "45000");
    ok({ kind: "decimal", value: 0.0034567, sf: 3 }, "0.00346");
    ok({ kind: "decimal", value: 0.0034567, sf: 3 }, "0.003460");
    no({ kind: "decimal", value: 0.0034567, sf: 3 }, "0.0035", FEEDBACK.rounding);
    ok({ kind: "decimal", value: 9.96, sf: 2 }, "10");
    ok({ kind: "decimal", value: 0, sf: 2 }, "0");
  });
  it("uses tolerance when given", () => {
    const t: AnswerSpec = { kind: "decimal", value: 12.5, tolerance: 0.1 };
    ok(t, "12.4");
    ok(t, "12.6");
    no(t, "12.7");
  });
  it("accepts and requires nothing else of the unit", () => {
    const u: AnswerSpec = { kind: "decimal", value: 7.5, unit: "cm" };
    ok(u, "7.5");
    ok(u, "7.5 cm");
    ok(u, "7.5\\text{ cm}");
    no(u, "7.5 kg", FEEDBACK.unreadable);
  });
  it("exact value with no rounding", () => {
    ok({ kind: "decimal", value: 0.3 }, "0.3");
    no({ kind: "decimal", value: 0.3 }, "0.33");
  });
});

describe("percentage", () => {
  const p: AnswerSpec = { kind: "percentage", value: 15 };
  it("accepts with or without %", () => {
    ok(p, "15");
    ok(p, "15%");
    ok(p, "15 %");
    ok(p, "15\\%");
    ok({ kind: "percentage", value: 12.5 }, "12.5%");
  });
  it("rejects other values", () => {
    no(p, "0.15");
    no(p, "16%");
    no(p, "%", FEEDBACK.unreadable);
  });
});

describe("mcq", () => {
  const spec: AnswerSpec = { kind: "mcq", correctIndex: 2 };
  it("compares the selected index", () => {
    ok(spec, "2");
    ok(spec, " 2 ");
    no(spec, "1");
    no(spec, "-1", FEEDBACK.unreadable);
    no(spec, "two", FEEDBACK.unreadable);
  });
});

describe("marks", () => {
  it("awards the question's marks for a correct single-part answer", () => {
    expect(check({ kind: "integer", value: 5 }, "5", 3)).toEqual({
      correct: true,
      marksAwarded: 3,
    });
    expect(check({ kind: "integer", value: 5 }, "6", 3)).toEqual({
      correct: false,
      marksAwarded: 0,
    });
  });
});

describe("robustness", () => {
  it("rejects answers over 200 characters", () =>
    no(thousand, "1".repeat(201), FEEDBACK.unreadable));
  it("rejects non-string input without throwing", () => {
    expect(check(thousand, undefined as unknown as string).correct).toBe(false);
    expect(check(thousand, 5 as unknown as string).correct).toBe(false);
  });
  it("survives a spec that makes the checker throw", () => {
    const evil = {
      kind: "decimal",
      value: 1,
      get unit(): string {
        throw new Error("boom");
      },
    } as unknown as AnswerSpec;
    no(evil, "1", FEEDBACK.unreadable);
  });
});

describe("solutions", () => {
  const two: AnswerSpec = { kind: "solutions", variable: "x", values: [2, -3] };
  const one: AnswerSpec = { kind: "solutions", variable: "y", values: [1.5] };

  it("PLAN.md 6.3: x=2 or x=-3 and -3, 2 are correct; 2 alone is wrong", () => {
    ok(two, "x=2 or x=-3");
    ok(two, "-3, 2");
    no(two, "2", FEEDBACK.extra);
  });
  it("accepts other separators, LaTeX and subscripts", () => {
    ok(two, "-3 and 2");
    ok(two, "x = 2; x = −3");
    ok(two, "$x = 2$ or $x = -3$");
    ok(two, "x_1 = 2, x_2 = -3");
    ok(two, "x=2 \\text{ or } x=-3");
    ok(two, "x = 2 \\lor x = -3");
  });
  it("rejects extras, duplicates and wrong values", () => {
    no(two, "2, -3, 4");
    no(two, "2, 2");
    no(two, "2, 3");
    no(two, "x = 2 or y = -3", FEEDBACK.unreadable);
  });
  it("accepts fractions and decimals for the value, and the right variable only", () => {
    ok(one, "y = 1.5");
    ok(one, "y = 3/2");
    ok(one, "\\frac{3}{2}");
    no(one, "x = 1.5", FEEDBACK.unreadable);
    no(one, "y =", FEEDBACK.unreadable);
  });
});

describe("ratio", () => {
  const spec: AnswerSpec = { kind: "ratio", parts: [2, 3] };
  it("accepts the simplest ratio in order", () => {
    ok(spec, "2:3");
    ok(spec, "2 : 3");
    ok(spec, "$2 : 3$");
    ok(spec, "2 \\colon 3");
    ok({ kind: "ratio", parts: [1, 2, 4] }, "1:2:4");
  });
  it("asks for simplification of an equivalent ratio", () => no(spec, "4:6", FEEDBACK.simplify));
  it("rejects the wrong order, wrong length and nonsense", () => {
    no(spec, "3:2");
    no(spec, "2:3:1");
    no(spec, "2/3", FEEDBACK.unreadable);
    no(spec, "a:b", FEEDBACK.unreadable);
  });
});

describe("standardForm", () => {
  const spec: AnswerSpec = { kind: "standardForm", mantissa: 4.5, exponent: 3 };
  it("PLAN.md 6.3: 4.5 \\times 10^{3} and 4.5e3 are correct", () => {
    ok(spec, "4.5 \\times 10^{3}");
    ok(spec, "4.5e3");
  });
  it("accepts other ways of writing it", () => {
    ok(spec, "4.5 x 10^3");
    ok(spec, "4.5*10^3");
    ok(spec, "4.5 × 10³");
    ok(spec, "$4.5 \\times 10^{3}$");
    ok({ kind: "standardForm", mantissa: 3.2, exponent: -4 }, "3.2 × 10⁻⁴");
    ok({ kind: "standardForm", mantissa: 3.2, exponent: -4 }, "3.2 \\times 10^{-4}");
  });
  it("wants standard form, not an equal number in another form", () => {
    no(spec, "4500", FEEDBACK.standardForm);
    no(spec, "45 \\times 10^{2}", FEEDBACK.standardForm);
    no(spec, "0.45e4", FEEDBACK.standardForm);
  });
  it("rejects wrong values and nonsense", () => {
    no(spec, "4.5 \\times 10^{4}");
    no(spec, "4600");
    no(spec, "four thousand", FEEDBACK.unreadable);
  });
});

describe("normalise edge cases", () => {
  it("keeps a lone $ as currency and strips paired $ as delimiters", () => {
    expect(normalise("$5")).toBe("$5");
    expect(normalise("$x = 2$ or $x = 3$")).toBe("x = 2 or x = 3");
    expect(normalise("10²")).toBe("10^{2}");
  });
  it("parses values used inside lists", () => {
    expect(parseValue("3/4")).toBe(0.75);
    expect(parseValue("2")).toBe(2);
    expect(parseValue("x")).toBeNull();
    expect(parseSolutions("", "x")).toBeNull();
    expect(parseRatio("2")).toBeNull();
    expect(parseStandardForm("4.5 * 10^{3}")).toEqual({ mantissa: 4.5, exponent: 3 });
  });
});
