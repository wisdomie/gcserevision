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

const KINDS = ["integer", "decimal", "money", "fraction", "percentage", "ratio", "mcq"] as const;

const RowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
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
});

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

  return {
    slug: row.slug,
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
