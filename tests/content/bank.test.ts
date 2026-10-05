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

  it("has about 100 valid questions", () => {
    expect(errors).toEqual([]);
    expect(questions.length).toBeGreaterThanOrEqual(100);
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
