import "server-only";
import { ApiError } from "@/lib/api/handler";
import { getGenerator, listGenerators } from "@/lib/engine/generators/registry";
import { createRng, randomSeed } from "@/lib/engine/rng";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { DAILY_COUNT, dailyDate, dailyEligible, planDaily, type DailySettings } from "./daily";
import type { DailyAttempt, DailyBoardRow, DailyOverview } from "./daily-types";
import { planWithBank } from "./bank";
import { loadBankGenerators } from "./bank-server";
import { publicPayload } from "./solo";
import { loadSubjectAndTopics } from "./solo-server";

type Admin = ReturnType<typeof createAdminClient>;

const asJson = (value: object) => value as unknown as Json;

/**
 * Creates the day's challenge if it doesn't exist yet and returns its
 * question instance ids. Safe to call from many requests at once: the
 * database keeps the first one.
 */
export async function ensureDailyChallenge(date: string, admin: Admin = createAdminClient()) {
  const { data: existing, error } = await admin
    .from("daily_challenges")
    .select("instance_ids")
    .eq("challenge_date", date)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.instance_ids;

  const { subjectId, topics } = await loadSubjectAndTopics(admin);
  const eligible = dailyEligible(listGenerators()).filter((g) => topics.has(g.topicSlug));
  const bank = dailyEligible(await loadBankGenerators(admin, {})).filter((g) =>
    topics.has(g.topicSlug),
  );
  const bankByKey = new Map(bank.map((g) => [g.key, g]));
  const plan = planWithBank((pool, s) => planDaily(pool, s), eligible, bank, randomSeed());
  const questions = plan.map((planned) => {
    const gen = getGenerator(planned.key) ?? bankByKey.get(planned.key)!;
    const topic = topics.get(gen.topicSlug)!;
    const q = gen.generate(createRng(planned.seed));
    return {
      topic_id: topic.id,
      generator_key: gen.key,
      seed: planned.seed,
      calculator: gen.calculator,
      marks: gen.marks,
      public_payload: publicPayload(q, gen, topic.name),
      answer_spec: q.answerSpec,
      solution: q.solution,
    };
  });

  const { data: ids, error: createError } = await admin.rpc("create_daily_challenge", {
    p_date: date,
    p_subject_id: subjectId,
    p_questions: asJson(questions),
  });
  if (createError) throw createError;
  return ids;
}

/** Starts (or resumes) the player's attempt at today's challenge. */
export async function startDaily(userId: string): Promise<{ sessionId: string }> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile?.tier) throw new ApiError(409, "Finish setting up your profile first.");

  const date = dailyDate();
  await ensureDailyChallenge(date, admin);
  const settings: Omit<DailySettings, "count"> = {
    mode: "daily",
    subject: "maths",
    date,
    timed: false,
  };
  const { data: sessionId, error: startError } = await admin.rpc("start_daily", {
    p_user_id: userId,
    p_date: date,
    p_settings: asJson(settings),
  });
  if (startError) throw startError;
  return { sessionId };
}

async function loadAttempt(admin: Admin, userId: string, date: string) {
  const { data: session, error } = await admin
    .from("solo_sessions")
    .select("id, score, finished_at")
    .eq("user_id", userId)
    .eq("settings->>mode", "daily")
    .eq("settings->>date", date)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const [{ data: links, error: linksError }, { data: answers, error: answersError }] =
    await Promise.all([
      admin.from("solo_session_questions").select("idx, instance_id").eq("session_id", session.id),
      admin.from("answers").select("instance_id, is_correct").eq("solo_session_id", session.id),
    ]);
  if (linksError) throw linksError;
  if (answersError) throw answersError;

  const correctByInstance = new Map(answers.map((a) => [a.instance_id, a.is_correct]));
  const results = links
    .sort((a, b) => a.idx - b.idx)
    .filter((l) => correctByInstance.has(l.instance_id))
    .map((l) => correctByInstance.get(l.instance_id)!);

  const attempt: DailyAttempt = {
    sessionId: session.id,
    finished: session.finished_at !== null,
    score: session.score,
    results,
  };
  return attempt;
}

/** Everything the daily page needs for the signed-in player. */
export async function getDailyOverview(userId: string): Promise<DailyOverview> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const date = dailyDate();

  const [attempt, streak] = await Promise.all([
    loadAttempt(admin, userId, date),
    supabase.rpc("my_daily_streak").then(({ data, error }) => {
      if (error) throw error;
      return data;
    }),
  ]);

  // Friends' scores show once you've finished, so nothing nudges you mid-attempt
  let board: DailyBoardRow[] | null = null;
  if (attempt?.finished) {
    const { data, error } = await supabase.rpc("daily_leaderboard", { p_date: date });
    if (error) throw error;
    board = data.map((r) => ({
      rank: Number(r.rank),
      username: r.username,
      avatar: r.avatar,
      points: r.points,
      correct: r.correct,
      total: r.total,
      streak: r.streak,
      isMe: r.is_me,
    }));
  }

  return { date, questionCount: DAILY_COUNT, attempt, streak, board };
}
