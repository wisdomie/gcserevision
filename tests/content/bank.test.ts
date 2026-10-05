import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bankQuestionFromRecord } from "@/lib/content/bank";
import { parseCsv, parseCsvRecords } from "@/lib/content/csv";
import { listGenerators } from "@/lib/engine/generators/registry";
import { loadBank } from "../../scripts/import-questions";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",z\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["two\nlines", "z"],
    ]);
  });
  it("skips blank lines and rejects an unclosed quote", () => {
    expect(parseCsv("a\n\n b \n")).toEqual([["a"], [" b "]]);
    expect(() => parseCsv('a,"b')).toThrow(/not closed/);
  });
  it("keys records by the header and checks the field count", () => {
    expect(parseCsvRecords("x,y\n1,2")).toEqual([{ x: "1", y: "2" }]);
    expect(() => parseCsvRecords("x,y\n1")).toThrow(/row 2/);
  });
});

const record = (over: Record<string, string> = {}) => ({
  slug: "test-q",
  topic: "fractions",
  tier: "both",
  calculator: "non-calc",
  boards: "all",
  difficulty: "2",
  marks: "2",
  kind: "integer",
  prompt: "How many sweets are left?",
  options: "",
  answer: "12",
  dp: "",
  unit: "",
  steps: "First || Second",
  final: "12",
  form: "",
  variable: "",
  ...over,
});

describe("bankQuestionFromRecord", () => {
  it("builds a checked question", () => {
    const q = bankQuestionFromRecord(record({ prompt: "Line one.\\n\\nLine two?" }));
    expect(q).toMatchObject({
      slug: "test-q",
      inputType: "numeric",
      answerSpec: { kind: "integer", value: 12 },
      solution: { steps: ["First", "Second"], final: "12" },
      promptMd: "Line one.\n\nLine two?",
      boards: "all",
    });
  });

  it("supports every answer kind", () => {
    expect(
      bankQuestionFromRecord(record({ kind: "money", answer: "7.50", final: "£7.50" })).answerSpec,
    ).toEqual({ kind: "decimal", value: 7.5, tolerance: 0.004 });
    expect(
      bankQuestionFromRecord(
        record({ kind: "decimal", answer: "91.786", dp: "1", unit: "cm", final: "91.8 cm" }),
      ).answerSpec,
    ).toEqual({ kind: "decimal", value: 91.786, dp: 1, unit: "cm" });
    expect(
      bankQuestionFromRecord(record({ kind: "fraction", answer: "3/8", final: "3/8" })).inputType,
    ).toBe("fraction");
    expect(
      bankQuestionFromRecord(record({ kind: "percentage", answer: "15", final: "15%" })).inputType,
    ).toBe("numeric");
    expect(
      bankQuestionFromRecord(record({ kind: "ratio", answer: "3:2", final: "3:2" })).answerSpec,
    ).toEqual({
      kind: "ratio",
      parts: [3, 2],
    });
    const mcq = bankQuestionFromRecord(
      record({ kind: "mcq", options: "a|b|c|d", answer: "c", final: "c" }),
    );
    expect(mcq).toMatchObject({
      options: ["a", "b", "c", "d"],
      answerSpec: { kind: "mcq", correctIndex: 2 },
    });
    expect(bankQuestionFromRecord(record({ boards: "aqa;ocr" })).boards).toEqual(["aqa", "ocr"]);
  });

  it("supports algebra answers", () => {
    const expr = bankQuestionFromRecord(
      record({
        kind: "expression",
        answer: "3(x + 2y)",
        form: "factorised",
        final: "$3(x + 2y)$",
      }),
    );
    expect(expr).toMatchObject({
      inputType: "expression",
      answerSpec: {
        kind: "expression",
        latex: "3(x + 2y)",
        variables: ["x", "y"],
        form: "factorised",
      },
    });
    // Commands such as \frac are not variables, and old CSVs have no form column
    const noForm: Record<string, string> = record({
      kind: "expression",
      answer: "\\frac{a}{2}",
      final: "$\\frac{a}{2}$",
    });
    delete noForm.form;
    expect(bankQuestionFromRecord(noForm).answerSpec).toEqual({
      kind: "expression",
      latex: "\\frac{a}{2}",
      variables: ["a"],
    });
    expect(
      bankQuestionFromRecord(
        record({ kind: "solutions", answer: "2;-5", final: "$x = 2$ or $x = -5$" }),
      ).answerSpec,
    ).toEqual({ kind: "solutions", variable: "x", values: [2, -5] });
    expect(
      bankQuestionFromRecord(
        record({ kind: "solutions", answer: "4", variable: "t", final: "$t = 4$" }),
      ).answerSpec,
    ).toEqual({ kind: "solutions", variable: "t", values: [4] });
    expect(() =>
      bankQuestionFromRecord(
        record({
          kind: "expression",
          answer: "x^2 + 5x + 6",
          form: "factorised",
          final: "$x^2 + 5x + 6$",
        }),
      ),
    ).toThrow(/fails the checker/);
    expect(
      bankQuestionFromRecord(
        record({ kind: "standard-form", answer: "3.2e-5", final: "$3.2 \\times 10^{-5}$" }),
      ).answerSpec,
    ).toEqual({ kind: "standardForm", mantissa: 3.2, exponent: -5 });
    expect(() =>
      bankQuestionFromRecord(record({ kind: "standard-form", answer: "32000", final: "32000" })),
    ).toThrow(/3.2e5/);
  });

  it("rejects mistakes", () => {
    expect(() => bankQuestionFromRecord(record({ final: "13" }))).toThrow(/fails the checker/);
    expect(() =>
      bankQuestionFromRecord(record({ kind: "mcq", options: "a|b|c", answer: "a", final: "a" })),
    ).toThrow(/4 options/);
    expect(() =>
      bankQuestionFromRecord(record({ kind: "mcq", options: "a|b|c|d", answer: "e", final: "e" })),
    ).toThrow(/not one of the options/);
    expect(() => bankQuestionFromRecord(record({ options: "a|b" }))).toThrow(/only mcq/);
    expect(() => bankQuestionFromRecord(record({ boards: "xyz" }))).toThrow(/unknown board/);
    expect(() =>
      bankQuestionFromRecord(record({ kind: "fraction", answer: "0.5", final: "1/2" })),
    ).toThrow(/3\/4/);
    expect(() => bankQuestionFromRecord(record({ slug: "Bad Slug" }))).toThrow();
  });
});

describe("the word-problem bank", () => {
  const { questions, errors } = loadBank();
  const seed = readFileSync(join(__dirname, "..", "..", "supabase", "seed.sql"), "utf8");
  const generatedTopics = new Set(listGenerators().map((g) => g.topicSlug));

  it("has about 250 valid questions", () => {
    expect(errors).toEqual([]);
    expect(questions.length).toBeGreaterThanOrEqual(240);
  });

  it("has at least 6 questions for every topic it covers", () => {
    const counts = new Map<string, number>();
    for (const q of questions) counts.set(q.topicSlug, (counts.get(q.topicSlug) ?? 0) + 1);
    for (const [topic, n] of counts) expect(n, topic).toBeGreaterThanOrEqual(6);
  });

  it("uses seeded topics that already have generated questions", () => {
    for (const q of questions) {
      expect(seed, q.slug).toContain(`('${q.topicSlug}',`);
      // So the topic shows in the topic picker
      expect(generatedTopics, q.slug).toContain(q.topicSlug);
    }
  });

  it("has clean text with balanced maths delimiters", () => {
    for (const q of questions) {
      for (const text of [
        q.promptMd,
        ...q.solution.steps,
        q.solution.final,
        ...(q.options ?? []),
      ]) {
        expect(text, q.slug).not.toMatch(/NaN|undefined|\|\|/);
        expect(
          (text.replace(/\\\$/g, "").match(/\$/g) ?? []).length % 2,
          `${q.slug}: ${text}`,
        ).toBe(0);
      }
    }
  });

  it("spreads questions across topics and difficulties", () => {
    expect(new Set(questions.map((q) => q.topicSlug)).size).toBeGreaterThanOrEqual(20);
    expect(new Set(questions.map((q) => q.difficulty)).size).toBeGreaterThanOrEqual(4);
  });
});
