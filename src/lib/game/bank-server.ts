import "server-only";
import type { BankQuestion } from "@/lib/content/bank";
import { filterGenerators, type GeneratorFilter } from "@/lib/engine/generators/registry";
import {
  AnswerSpecSchema,
  type BoardSlug,
  type InputType,
  type QuestionGenerator,
  type Solution,
} from "@/lib/engine/types";
import type { createAdminClient } from "@/lib/supabase/admin";
import { bankGenerator, isBankKey, type BankRow } from "./bank";

type Admin = ReturnType<typeof createAdminClient>;

const COLUMNS =
  "id, slug, tier, calculator, difficulty, marks, type, prompt_md, options, answer_spec, solution, topics(slug), question_boards(exam_boards(slug))";

interface DbRow {
  id: string;
  slug: string | null;
  tier: string;
  calculator: string;
  difficulty: number;
  marks: number;
  type: string;
  prompt_md: string;
  options: unknown;
  answer_spec: unknown;
  solution: unknown;
  topics: { slug: string } | null;
  question_boards: { exam_boards: { slug: string } | null }[];
}

function toRow(r: DbRow): BankRow | null {
  const spec = AnswerSpecSchema.safeParse(r.answer_spec);
  const solution = r.solution as Solution | null;
  if (!spec.success || !solution || !r.topics) return null;
  const boards = r.question_boards
    .map((b) => b.exam_boards?.slug)
    .filter((s): s is string => Boolean(s)) as BoardSlug[];
  return {
    id: r.id,
    slug: r.slug ?? r.id,
    topicSlug: r.topics.slug,
    tier: r.tier as BankQuestion["tier"],
    calculator: r.calculator as BankQuestion["calculator"],
    boards: boards.length > 0 ? boards : "all",
    difficulty: r.difficulty as BankQuestion["difficulty"],
    marks: r.marks,
    inputType: r.type as InputType,
    promptMd: r.prompt_md,
    options: Array.isArray(r.options) ? (r.options as string[]) : null,
    answerSpec: spec.data,
    solution,
  };
}

/** Published bank questions as generators, filtered like generated questions. */
export async function loadBankGenerators(
  admin: Admin,
  filter: GeneratorFilter,
): Promise<QuestionGenerator[]> {
  const { data, error } = await admin
    .from("questions")
    .select(COLUMNS)
    .eq("status", "published")
    .not("solution", "is", null);
  if (error) throw error;
  const gens = (data as unknown as DbRow[])
    .map(toRow)
    .filter((r): r is BankRow => r !== null)
    .map(bankGenerator);
  return filterGenerators(gens, filter);
}

/** One bank question by its `bank:<id>` key, for serving a planned question. */
export async function loadBankGenerator(
  admin: Admin,
  key: string,
): Promise<QuestionGenerator | undefined> {
  if (!isBankKey(key)) return undefined;
  const { data, error } = await admin
    .from("questions")
    .select(COLUMNS)
    .eq("id", key.slice("bank:".length))
    .maybeSingle();
  if (error) throw error;
  const row = data && toRow(data as unknown as DbRow);
  return row ? bankGenerator(row) : undefined;
}
