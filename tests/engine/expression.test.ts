import { describe, expect, it } from "vitest";
import { check, FEEDBACK, marksForParts } from "@/lib/engine/answers/check";
import {
  equivalent,
  evaluate,
  isExpanded,
  isFactorised,
  isSimplified,
  parseExpression,
  stripSubject,
  toPolynomial,
  variablesOf,
  type Node,
} from "@/lib/engine/answers/expression";
import type { AnswerSpec } from "@/lib/engine/types";

const expr = (
  latex: string,
  form?: "any" | "expanded" | "factorised" | "simplified",
): AnswerSpec => ({
  kind: "expression",
  latex,
  variables: ["x"],
  ...(form ? { form } : {}),
});
const ok = (spec: AnswerSpec, raw: string) => expect(check(spec, raw).correct, raw).toBe(true);
const no = (spec: AnswerSpec, raw: string, feedback?: string) => {
  const r = check(spec, raw);
  expect(r.correct, raw).toBe(false);
  if (feedback !== undefined) expect(r.feedback, raw).toBe(feedback);
};
const parse = (s: string) => {
  const node = parseExpression(s);
  if (!node) throw new Error(`could not parse ${s}`);
  return node;
};
const at = (s: string, env: Record<string, number>) => evaluate(parse(s), env);

// PLAN.md 6.3 table rows for expressions
describe("PLAN.md 6.3 table", () => {
  it("expression 2x+4 (any form): 4+2x and 2(x+2) are correct", () => {
    ok(expr("2x+4"), "4+2x");
    ok(expr("2x+4"), "2(x+2)");
    ok(expr("2x+4"), "2x+4");
  });
  it("expression 2(x+2) (factorised): 2x+4 is wrong (wrong form)", () => {
    no(expr("2(x+2)", "factorised"), "2x+4", FEEDBACK.factorise);
    ok(expr("2(x+2)", "factorised"), "2(x+2)");
    ok(expr("2(x+2)", "factorised"), "2(2+x)");
  });
  it("expression x^2-4 (expanded): (x-2)(x+2) is wrong (wrong form)", () => {
    no(expr("x^2-4", "expanded"), "(x-2)(x+2)", FEEDBACK.expand);
    ok(expr("x^2-4", "expanded"), "x^2-4");
    ok(expr("x^2-4", "expanded"), "-4+x^{2}");
  });
  it("garbage input is wrong and never throws", () => {
    for (const raw of [
      "",
      "abc(",
      "1/0",
      ")(",
      "x^",
      "\\frac{1}",
      "2++x",
      "\\sin x",
      "x==2",
      "{{x}",
    ]) {
      expect(() => check(expr("2x+4"), raw)).not.toThrow();
      expect(check(expr("2x+4"), raw).correct).toBe(false);
    }
  });
});

describe("parseExpression", () => {
  it("handles implicit multiplication and precedence", () => {
    expect(at("2x", { x: 3 })).toBe(6);
    expect(at("2(x+1)", { x: 3 })).toBe(8);
    expect(at("(x+1)(x+2)", { x: 3 })).toBe(20);
    expect(at("xy", { x: 3, y: 4 })).toBe(12);
    expect(at("2x^2", { x: 3 })).toBe(18);
    expect(at("-x^2", { x: 3 })).toBe(-9);
    expect(at("(-x)^2", { x: 3 })).toBe(9);
    expect(at("2^3^2", {})).toBe(512);
    expect(at("x^-1", { x: 4 })).toBe(0.25);
    expect(at("10-3-2", {})).toBe(5);
    expect(at("12/3/2", {})).toBe(2);
    expect(at("3x/2", { x: 4 })).toBe(6);
    expect(at(".5x", { x: 4 })).toBe(2);
  });

  it("reads MathLive LaTeX", () => {
    expect(at("2\\left(x+2\\right)", { x: 1 })).toBe(6);
    expect(at("x^{2}-4", { x: 3 })).toBe(5);
    expect(at("\\frac{y-2}{3}", { y: 11 })).toBe(3);
    expect(at("\\dfrac{1}{2}x", { x: 6 })).toBe(3);
    expect(at("3\\cdot x", { x: 2 })).toBe(6);
    expect(at("3\\times x", { x: 2 })).toBe(6);
    expect(at("\\sqrt{x}", { x: 9 })).toBe(3);
    expect(at("\\sqrt x", { x: 16 })).toBe(4);
    expect(at("2\\pi", {})).toBeCloseTo(2 * Math.PI);
    expect(at("x^{-2}", { x: 2 })).toBe(0.25);
    expect(at("[x+1]", { x: 2 })).toBe(3);
    expect(at("2 ÷ 4 × x", { x: 8 })).toBe(4);
  });

  it.each([
    "",
    "  ",
    "(x",
    "x)",
    "x^",
    "\\frac{1}",
    "2+",
    "*2",
    "\\sin x",
    "#",
    "1..2",
    "2 3",
    "{x",
    "x".repeat(201),
  ])("rejects %j", (s) => expect(parseExpression(s)).toBeNull());

  it("finds variables, including Greek letters", () => {
    expect([...variablesOf(parse("2x + \\theta y"))].sort()).toEqual(["theta", "x", "y"]);
    expect(evaluate(parse("z"), {})).toBeNaN();
  });

  it("strips a subject", () => {
    expect(stripSubject("x = (y-2)/3")).toBe(" (y-2)/3");
    expect(stripSubject("x==2")).toBe("x==2");
    expect(stripSubject("2x+1")).toBe("2x+1");
  });
});

describe("equivalent", () => {
  const eq = (a: string, b: string) => equivalent(parse(a), parse(b));
  it("compares by value at random points", () => {
    expect(eq("(x+1)^2", "x^2+2x+1")).toBe(true);
    expect(eq("(x+1)^2", "x^2+1")).toBe(false);
    expect(eq("\\frac{x^2-1}{x-1}", "x+1")).toBe(true); // undefined at x = 1 only
    expect(eq("2(a+b)", "2a+2b")).toBe(true);
    expect(eq("2(a+b)", "2a+2c")).toBe(false);
    expect(eq("6", "2\\times 3")).toBe(true);
  });
  it("needs enough defined points", () => {
    expect(eq("\\sqrt{-1-x^2}", "\\sqrt{-1-x^2}")).toBe(false);
  });
});

describe("toPolynomial", () => {
  const poly = (s: string) => {
    const p = toPolynomial(parse(s));
    return p && Object.fromEntries([...p].sort());
  };
  it("expands products and powers", () => {
    expect(poly("(x+1)(x+2)")).toEqual({ "": 2, x: 3, "x^2": 1 });
    expect(poly("(x-y)^2")).toEqual({ "x^2": 1, "x*y": -2, "y^2": 1 });
    expect(poly("\\frac{4x+2}{2}")).toEqual({ "": 1, x: 2 });
    expect(poly("x^0 + 0")).toEqual({ "": 1 });
  });
  it("returns null for non-polynomials", () => {
    expect(poly("\\frac{1}{x}")).toBeNull();
    expect(poly("x^{1/2}")).toBeNull();
    expect(poly("x^{-1}")).toBeNull();
    expect(poly("\\sqrt{x}")).toBeNull();
    expect(poly("x^{20}")).toBeNull();
  });
});

describe("form checks", () => {
  const form = (fn: (n: Node) => boolean, s: string) => fn(parse(s));

  it("expanded", () => {
    for (const s of ["x^2+5x+6", "6+5x+x^2", "2x+4", "-x-3", "x^2y+3"])
      expect(form(isExpanded, s), s).toBe(true);
    for (const s of [
      "(x+2)(x+3)",
      "x(x+5)+6",
      "(x+1)^2",
      "-(x+3)",
      "x^2+2x+3x+6",
      "x^2+5x+6+0",
      "2\\times3x",
    ]) {
      expect(form(isExpanded, s), s).toBe(false);
    }
  });

  it("factorised", () => {
    for (const s of [
      "2(x+2)",
      "x(x+3)",
      "(x+1)(x+2)",
      "(x+3)^2",
      "-(x-1)(x+1)",
      "3x(2x-1)",
      "2(x+1)(x+3)",
    ]) {
      expect(form(isFactorised, s), s).toBe(true);
    }
    for (const s of ["2x+4", "(2x+4)", "2(2x+4)", "x(2x+4x^2)", "2\\times x", "x^2-4"]) {
      expect(form(isFactorised, s), s).toBe(false);
    }
  });

  it("simplified", () => {
    for (const s of ["5x", "5x+3y", "3a-2b+4", "x^2+x", "\\frac{x}{2}+1"])
      expect(form(isSimplified, s), s).toBe(true);
    for (const s of ["3x+2x", "x+y+x", "x\\times x", "2\\times3x", "x-x+1", "2(x+1)"]) {
      expect(form(isSimplified, s), s).toBe(false);
    }
  });
});

describe("expression answers", () => {
  it("accepts a subject prefix for rearranging", () => {
    const spec: AnswerSpec = { kind: "expression", latex: "\\frac{y-2}{3}", variables: ["x", "y"] };
    ok(spec, "x = (y-2)/3");
    ok(spec, "x=\\frac{y-2}{3}");
    ok(spec, "y/3 - 2/3");
    no(spec, "x = (y+2)/3");
  });
  it("simplified form", () => {
    const spec = expr("5x+3y", "simplified");
    ok(spec, "5x+3y");
    ok(spec, "3y+5x");
    no(spec, "2x+3x+3y", FEEDBACK.simplify);
    no(spec, "5x+2y");
  });
  it("wrong values get no form feedback", () => {
    expect(check(expr("2(x+2)", "factorised"), "2(x+3)")).toEqual({
      correct: false,
      marksAwarded: 0,
    });
  });
  it("a broken reference is marked wrong, not thrown", () => {
    no({ kind: "expression", latex: "((", variables: ["x"] }, "x");
  });
});

describe("multi", () => {
  const spec: AnswerSpec = {
    kind: "multi",
    parts: [
      { label: "a", spec: { kind: "integer", value: 3 } },
      { label: "b", spec: expr("2(x+2)", "factorised") },
    ],
  };

  it("awards marks per part", () => {
    expect(check(spec, JSON.stringify(["3", "2(x+2)"]), 2)).toEqual({
      correct: true,
      marksAwarded: 2,
    });
    expect(check(spec, JSON.stringify(["3", "2x+4"]), 2)).toEqual({
      correct: false,
      marksAwarded: 1,
      feedback: "1 of 2 parts correct",
    });
    expect(check(spec, JSON.stringify(["4", "x"]), 2)).toEqual({
      correct: false,
      marksAwarded: 0,
      feedback: "0 of 2 parts correct",
    });
  });

  it("uses marksPerPart when given", () => {
    const weighted: AnswerSpec = { ...spec, marksPerPart: [1, 3] } as AnswerSpec;
    expect(check(weighted, JSON.stringify(["4", "2(x+2)"]), 4).marksAwarded).toBe(3);
  });

  it("rejects malformed input", () => {
    for (const raw of ["3", "[]", '["3"]', '["3", 4]', "{", '{"a":1}'])
      no(spec, raw, FEEDBACK.unreadable);
  });

  it("splits marks evenly", () => {
    expect(marksForParts(3, 5)).toEqual([2, 2, 1]);
    expect(marksForParts(2, 1)).toEqual([1, 0]);
    expect(marksForParts(2, 4, [1, 3])).toEqual([1, 3]);
    expect(marksForParts(2, 4, [1])).toEqual([2, 2]);
  });
});
