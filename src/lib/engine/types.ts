import { z } from "zod";
import type { Diagram } from "./diagram";

export type Tier = "foundation" | "higher";
export type CalcMode = "calc" | "non-calc" | "either";
export type BoardSlug = "aqa" | "edexcel" | "ocr" | "wjec-eduqas";

export const TIERS = ["foundation", "higher"] as const satisfies readonly Tier[];
export const BOARD_SLUGS = [
  "aqa",
  "edexcel",
  "ocr",
  "wjec-eduqas",
] as const satisfies readonly BoardSlug[];

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  /** Returns a shuffled copy. */
  shuffle<T>(arr: readonly T[]): T[];
}

// ---------------------------------------------------------------------------
// AnswerSpec (PLAN.md 6.2)
// ---------------------------------------------------------------------------

export type AnswerSpec =
  | { kind: "mcq"; correctIndex: number }
  | { kind: "integer"; value: number }
  | {
      kind: "decimal";
      value: number;
      dp?: number;
      sf?: number;
      tolerance?: number;
      unit?: string;
    }
  | { kind: "fraction"; num: number; den: number; mustBeSimplest: boolean; allowMixed?: boolean }
  | { kind: "percentage"; value: number }
  | {
      kind: "expression";
      latex: string;
      variables: string[];
      form?: "any" | "expanded" | "factorised" | "simplified";
    }
  | { kind: "solutions"; variable: string; values: number[] }
  | { kind: "ratio"; parts: number[] }
  | { kind: "standardForm"; mantissa: number; exponent: number }
  | { kind: "multi"; parts: { label: string; spec: AnswerSpec }[]; marksPerPart?: number[] };

export type AnswerKind = AnswerSpec["kind"];

const finite = z.number().finite();
const int = z.number().int();

export const AnswerSpecSchema: z.ZodType<AnswerSpec> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("mcq"), correctIndex: int.nonnegative() }),
    z.object({ kind: z.literal("integer"), value: int }),
    z
      .object({
        kind: z.literal("decimal"),
        value: finite,
        dp: int.min(0).max(10).optional(),
        sf: int.min(1).max(15).optional(),
        tolerance: finite.nonnegative().optional(),
        unit: z.string().min(1).max(20).optional(),
      })
      .refine((s) => s.dp === undefined || s.sf === undefined, "Set dp or sf, not both"),
    z.object({
      kind: z.literal("fraction"),
      num: int,
      den: int.positive(),
      mustBeSimplest: z.boolean(),
      allowMixed: z.boolean().optional(),
    }),
    z.object({ kind: z.literal("percentage"), value: finite }),
    z.object({
      kind: z.literal("expression"),
      latex: z.string().min(1),
      variables: z.array(z.string().min(1)),
      form: z.enum(["any", "expanded", "factorised", "simplified"]).optional(),
    }),
    z.object({
      kind: z.literal("solutions"),
      variable: z.string().min(1),
      values: z.array(finite).min(1),
    }),
    z.object({ kind: z.literal("ratio"), parts: z.array(finite).min(2) }),
    z.object({ kind: z.literal("standardForm"), mantissa: finite, exponent: int }),
    z.object({
      kind: z.literal("multi"),
      parts: z.array(z.object({ label: z.string().min(1), spec: AnswerSpecSchema })).min(1),
      marksPerPart: z.array(int.nonnegative()).optional(),
    }),
  ]),
);

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export type InputType = "mcq" | "numeric" | "expression" | "fraction" | "multi";

/** The input type a player answers with for each AnswerSpec kind. */
export const INPUT_TYPE_FOR_KIND: Record<AnswerKind, InputType> = {
  mcq: "mcq",
  integer: "numeric",
  decimal: "numeric",
  percentage: "numeric",
  fraction: "fraction",
  expression: "expression",
  solutions: "expression",
  ratio: "expression",
  standardForm: "expression",
  multi: "multi",
};

export interface Solution {
  /** Markdown + $LaTeX$ */
  steps: string[];
  /** Markdown + $LaTeX$; must pass `check(answerSpec, final)` (for mcq: equals the correct option). */
  final: string;
}

export interface GeneratedQuestion {
  /** Markdown + $LaTeX$ */
  promptMd: string;
  inputType: InputType;
  /** mcq only (already shuffled) */
  options?: string[];
  /** A picture the question needs. Must not give the answer away. */
  diagram?: Diagram;
  answerSpec: AnswerSpec;
  solution: Solution;
}

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface QuestionGenerator {
  /** e.g. 'number.fractions.add' */
  key: string;
  /** Matches a `topics.slug` in supabase/seed.sql */
  topicSlug: string;
  tiers: Tier[];
  calculator: CalcMode;
  marks: number;
  difficulty: Difficulty;
  boards: BoardSlug[] | "all";
  needsDiagram?: boolean;
  generate(rng: Rng): GeneratedQuestion;
}

/** What the client is allowed to see. Never contains the answer or solution. */
export interface PublicQuestion {
  instanceId: string;
  promptMd: string;
  inputType: InputType;
  options?: string[];
  diagram?: Diagram;
  marks: number;
  calculator: CalcMode;
  topicName: string;
}

export interface CheckResult {
  correct: boolean;
  marksAwarded: number;
  feedback?: string;
}
