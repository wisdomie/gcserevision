// Hand-written question bank (PLAN.md 2 and M8): turns CSV rows into checked
// questions. Pure, so the importer and the tests share it.
import { z } from "zod";
import { check } from "@/lib/engine/answers/check";
import {
  AnswerSpecSchema,
  BOARD_SLUGS,
  INPUT_TYPE_FOR_KIND,
  type AnswerSpec,
  type BoardSlug,
  type CalcMode,
  type InputType,
  type Solution,
} from "@/lib/engine/types";

export interface BankQuestion {
  slug: string;
  subjectSlug: string;
  topicSlug: string;
  tier: "foundation" | "higher" | "both";
  calculator: CalcMode;
  boards: BoardSlug[] | "all";
  difficulty: 1 | 2 | 3 | 4 | 5;
  marks: number;
  inputType: InputType;
  promptMd: string;
  options: string[] | null;
  answerSpec: AnswerSpec;
  solution: Solution;
}

const KINDS = [
  "integer",
  "decimal",
  "money",
  "fraction",
  "percentage",
  "ratio",
  "mcq",
  "expression",
  "solutions",
  "standard-form",
  "keywords",
] as const;

const RowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  /** Optional column: the subject the topic belongs to (default maths). */
  subject: z
    .string()
    .regex(/^[a-z0-9-]*$/)
    .optional()
    .default(""),
  topic: z.string().regex(/^[a-z0-9-]{1,60}$/),
  tier: z.enum(["foundation", "higher", "both"]),
  calculator: z.enum(["calc", "non-calc", "either"]),
  boards: z.string(),
  difficulty: z.coerce.number().int().min(1).max(5),
  marks: z.coerce.number().int().min(1).max(6),
  kind: z.enum(KINDS),
  prompt: z.string().min(10),
  options: z.string(),
  answer: z.string().min(1),
  dp: z.string(),
  unit: z.string(),
  steps: z.string().min(1),
  final: z.string().min(1),
  /** expression only: the form the answer must be in (default: any equivalent form). */
  form: z.enum(["", "any", "expanded", "factorised", "simplified"]).optional().default(""),
  /** solutions only: the letter being solved for (default x). */
  variable: z
    .string()
    .regex(/^[a-z]?$/)
    .optional()
    .default(""),
  /** keywords only: how many marking points earn full marks (default: all). */
  need: z.string().regex(/^\d*$/).optional().default(""),
  /** keywords only: |-separated phrases that make an answer wrong. */
  reject: z.string().optional().default(""),
  /** Optional: |-separated wrong answers the marker must not accept, as a check on the row. */
  wrong: z.string().optional().default(""),
  /** Optional: |-separated other right answers the marker must accept in full. */
  right: z.string().optional().default(""),
});

/** The single-letter variables in a LaTeX expression, ignoring commands like \frac. */
function variablesIn(latex: string): string[] {
  const letters = latex.replace(/\\[a-zA-Z]+/g, "").match(/[a-zA-Z]/g) ?? [];
  return [...new Set(letters)].sort();
}

/** "\n" in a CSV cell is a line break; " || " separates solution steps. */
const unescape = (s: string) => s.replace(/\\n/g, "\n").trim();

function toNumber(s: string, what: string): number {
  const x = Number(s.replace(/[£,%\s]/g, ""));
  if (!Number.isFinite(x)) throw new Error(`${what} is not a number: "${s}"`);
  return x;
}

function answerSpec(row: z.infer<typeof RowSchema>, options: string[] | null): AnswerSpec {
  const unit = row.unit.trim() || undefined;
  const dp = row.dp.trim() ? Number(row.dp) : undefined;
  switch (row.kind) {
    case "integer":
      return { kind: "integer", value: toNumber(row.answer, "answer") };
    case "decimal":
      return {
        kind: "decimal",
        value: toNumber(row.answer, "answer"),
        ...(dp !== undefined ? { dp } : {}),
        ...(unit ? { unit } : {}),
      };
    case "money":
      // Money is checked to the penny; "£" is optional when typing
      return { kind: "decimal", value: toNumber(row.answer, "answer"), tolerance: 0.004 };
    case "percentage":
      return { kind: "percentage", value: toNumber(row.answer, "answer") };
    case "fraction": {
      const m = /^(-?\d+)\/(\d+)$/.exec(row.answer.trim());
      if (!m) throw new Error(`fraction answer must look like 3/4: "${row.answer}"`);
      return { kind: "fraction", num: Number(m[1]), den: Number(m[2]), mustBeSimplest: false };
    }
    case "ratio":
      return { kind: "ratio", parts: row.answer.split(":").map((p) => toNumber(p, "ratio part")) };
    case "expression":
      return {
        kind: "expression",
        latex: row.answer.trim(),
        variables: variablesIn(row.answer),
        ...(row.form ? { form: row.form } : {}),
      };
    case "solutions":
      return {
        kind: "solutions",
        variable: row.variable || "x",
        values: row.answer.split(";").map((v) => toNumber(v, "solution")),
      };
    case "standard-form": {
      // Written as 3.2e5 in the CSV
      const m = /^([+-]?\d+(?:\.\d+)?)e([+-]?\d+)$/.exec(row.answer.trim());
      if (!m) throw new Error(`standard form answer must look like 3.2e5: "${row.answer}"`);
      return { kind: "standardForm", mantissa: Number(m[1]), exponent: Number(m[2]) };
    }
    case "keywords": {
      // Marking points separated by ";", accepted alternatives by "|"
      const groups = row.answer
        .split(";")
        .map((g) =>
          g
            .split("|")
            .map((p) => p.trim())
            .filter(Boolean),
        )
        .filter((g) => g.length > 0);
      const reject = row.reject
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean);
      return {
        kind: "keywords",
        groups,
        ...(row.need ? { need: Number(row.need) } : {}),
        ...(reject.length ? { reject } : {}),
      };
    }
    case "mcq": {
      const correctIndex = options?.indexOf(unescape(row.answer)) ?? -1;
      if (correctIndex < 0) throw new Error(`mcq answer "${row.answer}" is not one of the options`);
      return { kind: "mcq", correctIndex };
    }
  }
}

/** Validates one CSV record and checks its answer with the real marker. Throws on any problem. */
export function bankQuestionFromRecord(record: Record<string, string>): BankQuestion {
  const row = RowSchema.parse(record);
  const options = row.kind === "mcq" ? row.options.split("|").map(unescape) : null;
  if (options) {
    if (options.length !== 4) throw new Error(`${row.slug}: mcq needs 4 options`);
    if (new Set(options).size !== 4) throw new Error(`${row.slug}: mcq options must differ`);
  } else if (row.options.trim()) {
    throw new Error(`${row.slug}: only mcq questions have options`);
  }

  const boards =
    row.boards.trim() === "all"
      ? "all"
      : row.boards.split(";").map((b) => {
          const slug = b.trim() as BoardSlug;
          if (!BOARD_SLUGS.includes(slug)) throw new Error(`${row.slug}: unknown board "${b}"`);
          return slug;
        });

  const spec = AnswerSpecSchema.parse(answerSpec(row, options));
  const solution: Solution = {
    steps: row.steps.split("||").map(unescape).filter(Boolean),
    final: unescape(row.final),
  };
  const raw = spec.kind === "mcq" ? String(spec.correctIndex) : solution.final;
  const result = check(spec, raw, row.marks);
  if (!result.correct)
    throw new Error(`${row.slug}: the final answer "${solution.final}" fails the checker`);
  if (spec.kind === "mcq" && options![spec.correctIndex] !== solution.final)
    throw new Error(`${row.slug}: final must equal the correct option`);
  for (const r of row.right
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (!check(spec, r, row.marks).correct)
      throw new Error(`${row.slug}: the right answer "${r}" is not marked correct`);
  }
  for (const w of row.wrong
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (check(spec, w, row.marks).correct)
      throw new Error(`${row.slug}: the wrong answer "${w}" is marked correct`);
  }

  return {
    slug: row.slug,
    subjectSlug: row.subject || "maths",
    topicSlug: row.topic,
    tier: row.tier,
    calculator: row.calculator,
    boards,
    difficulty: row.difficulty as BankQuestion["difficulty"],
    marks: row.marks,
    inputType: INPUT_TYPE_FOR_KIND[spec.kind],
    promptMd: unescape(row.prompt),
    options,
    answerSpec: spec,
    solution,
  };
}
