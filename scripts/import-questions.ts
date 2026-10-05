// Loads the hand-written question bank (content/questions/*.csv) into the
// database. Every question is validated and its answer checked with the real
// marker first; nothing is written if any row fails.
//
//   pnpm import:questions           validate and upsert (needs Supabase env)
//   pnpm import:questions --check   validate only
//
// Questions are upserted by slug. A slug removed from the CSV is set back to
// 'draft' rather than deleted, because old games still point at it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { bankQuestionFromRecord, type BankQuestion } from "../src/lib/content/bank";
import { parseCsvRecords } from "../src/lib/content/csv";
import type { Database } from "../src/types/database";

const DIR = join(import.meta.dirname, "..", "content", "questions");

export function loadBank(): { questions: BankQuestion[]; errors: string[] } {
  const questions: BankQuestion[] = [];
  const errors: string[] = [];
  const slugs = new Set<string>();
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".csv"))) {
    const records = parseCsvRecords(readFileSync(join(DIR, file), "utf8"));
    records.forEach((record, i) => {
      try {
        const q = bankQuestionFromRecord(record);
        if (slugs.has(q.slug)) throw new Error(`duplicate slug ${q.slug}`);
        slugs.add(q.slug);
        questions.push(q);
      } catch (e) {
        errors.push(`${file} row ${i + 2}: ${(e as Error).message}`);
      }
    });
  }
  return { questions, errors };
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const { questions, errors } = loadBank();
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(`${questions.length} questions are valid.`);
  if (process.argv.includes("--check")) return;

  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI sets the environment directly
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const { data: subject } = await db.from("subjects").select("id").eq("slug", "maths").single();
  const { data: topics } = await db.from("topics").select("id, slug").eq("subject_id", subject!.id);
  const { data: boards } = await db.from("exam_boards").select("id, slug");
  const topicId = new Map(topics!.map((t) => [t.slug, t.id]));
  const boardId = new Map(boards!.map((b) => [b.slug, b.id]));

  const missing = questions.filter((q) => !topicId.has(q.topicSlug));
  if (missing.length > 0)
    throw new Error(
      `Unknown topics: ${missing.map((q) => `${q.slug} (${q.topicSlug})`).join(", ")}`,
    );

  const { data: saved, error } = await db
    .from("questions")
    .upsert(
      questions.map((q) => ({
        slug: q.slug,
        subject_id: subject!.id,
        topic_id: topicId.get(q.topicSlug)!,
        tier: q.tier,
        calculator: q.calculator,
        type: q.inputType,
        marks: q.marks,
        difficulty: q.difficulty,
        prompt_md: q.promptMd,
        options: q.options,
        answer_spec: q.answerSpec as never,
        solution: q.solution as never,
        solution_md: [...q.solution.steps, `Answer: ${q.solution.final}`].join("\n"),
        status: "published",
      })),
      { onConflict: "slug" },
    )
    .select("id, slug");
  if (error) throw error;

  const idBySlug = new Map(saved.map((s) => [s.slug!, s.id]));
  // Filters on many ids go in the URL, so send them in batches
  for (const ids of chunks([...idBySlug.values()], 100)) {
    const { error: clearError } = await db.from("question_boards").delete().in("question_id", ids);
    if (clearError) throw clearError;
  }
  const boardRows = questions.flatMap((q) =>
    q.boards === "all"
      ? []
      : q.boards.map((b) => ({
          question_id: idBySlug.get(q.slug)!,
          exam_board_id: boardId.get(b)!,
        })),
  );
  if (boardRows.length > 0) {
    const { error: boardError } = await db.from("question_boards").insert(boardRows);
    if (boardError) throw boardError;
  }

  const { data: published, error: listError } = await db
    .from("questions")
    .select("id, slug")
    .not("slug", "is", null)
    .eq("status", "published");
  if (listError) throw listError;
  const inBank = new Set(questions.map((q) => q.slug));
  const retired = published.filter((q) => !inBank.has(q.slug!));
  for (const ids of chunks(
    retired.map((q) => q.id),
    100,
  )) {
    const { error: retireError } = await db
      .from("questions")
      .update({ status: "draft" })
      .in("id", ids);
    if (retireError) throw retireError;
  }

  console.log(
    `Imported ${saved.length} questions` +
      (retired.length ? `; set ${retired.length} removed ones to draft.` : "."),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
