import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api/handler";
import { check } from "@/lib/engine/answers/check";
import { getGenerator, listGenerators } from "@/lib/engine/generators/registry";
import { createRng, randomSeed } from "@/lib/engine/rng";
import { soloPoints, nextStreak } from "@/lib/engine/scoring";
import { AnswerSpecSchema, type BoardSlug, type Solution, type Tier } from "@/lib/engine/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import {
  currentStreak,
  planSoloSession,
  SOLO_SECONDS_PER_QUESTION,
  SoloSettingsSchema,
  summariseByTopic,
  publicPayload,
  type PublicPayload,
  type SoloSettings,
  type SoloStartInput,
} from "./solo";
import { planWithBank } from "./bank";
import { loadBankGenerator, loadBankGenerators } from "./bank-server";
import { DailySettingsSchema } from "./daily";
import type { SoloAnswerResult, SoloCurrentQuestion, SoloState, SoloSummary } from "./solo-types";

type Admin = ReturnType<typeof createAdminClient>;

/** A solo session is plain practice or a daily attempt (PLAN.md M6). */
const SessionSettingsSchema = z.discriminatedUnion("mode", [
  SoloSettingsSchema,
  DailySettingsSchema,
]);

/** Our payloads are plain JSON objects; the generated DB types need the cast. */
const asJson = (value: object) => value as unknown as Json;

const SUBJECT = "maths";

interface Topic {
  id: number;
  name: string;
}

export async function loadSubjectAndTopics(admin: Admin) {
  const { data: subject, error } = await admin
    .from("subjects")
    .select("id")
    .eq("slug", SUBJECT)
    .single();
  if (error || !subject) throw new Error(`Subject ${SUBJECT} missing: ${error?.message}`);
  const { data: topics, error: topicsError } = await admin
    .from("topics")
    .select("id, slug, name")
    .eq("subject_id", subject.id);
  if (topicsError) throw topicsError;
  return {
    subjectId: subject.id,
    topics: new Map<string, Topic>(topics.map((t) => [t.slug, { id: t.id, name: t.name }])),
  };
}

async function loadPlayer(
  admin: Admin,
  userId: string,
): Promise<{ tier: Tier; board: BoardSlug | null }> {
  const { data, error } = await admin
    .from("profiles")
    .select("tier, exam_boards(slug)")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.tier) throw new ApiError(409, "Finish setting up your profile first.");
  return {
    tier: data.tier as Tier,
    board: (data.exam_boards?.slug as BoardSlug | undefined) ?? null,
  };
}

/** Generates question `idx` of a session from its plan and stores it. */
async function serveQuestion(
  admin: Admin,
  sessionId: string,
  settings: SoloSettings,
  idx: number,
  subjectId: number,
  topics: Map<string, Topic>,
): Promise<SoloCurrentQuestion> {
  const planned = settings.plan[idx];
  const gen =
    planned && (getGenerator(planned.key) ?? (await loadBankGenerator(admin, planned.key)));
  const topic = gen && topics.get(gen.topicSlug);
  if (!gen || !topic) throw new Error(`Cannot serve question ${idx} of session ${sessionId}`);

  const q = gen.generate(createRng(planned.seed));
  const payload = publicPayload(q, gen, topic.name);

  const { data: instanceId, error } = await admin.rpc("serve_solo_question", {
    p_session_id: sessionId,
    p_idx: idx,
    p_subject_id: subjectId,
    p_topic_id: topic.id,
    p_generator_key: gen.key,
    p_seed: planned.seed,
    p_tier: settings.tier,
    p_calculator: gen.calculator,
    p_marks: gen.marks,
    p_public_payload: asJson(payload),
    p_answer_spec: asJson(q.answerSpec),
    p_solution: asJson(q.solution),
  });
  if (error) throw error;
  return { index: idx, question: { instanceId, ...payload } };
}

export async function startSoloSession(userId: string, input: SoloStartInput): Promise<SoloState> {
  const admin = createAdminClient();
  const player = await loadPlayer(admin, userId);
  const { subjectId, topics } = await loadSubjectAndTopics(admin);

  const filter = {
    tier: player.tier,
    board: player.board ?? undefined,
    topicSlugs: input.topicSlugs,
  };
  const generators = listGenerators(filter).filter((g) => topics.has(g.topicSlug));
  const bank = (await loadBankGenerators(admin, filter)).filter((g) => topics.has(g.topicSlug));
  if (generators.length + bank.length === 0)
    throw new ApiError(400, "There are no questions for those topics yet.");

  const seed = randomSeed();
  const settings: SoloSettings = {
    mode: "solo",
    subject: SUBJECT,
    board: player.board,
    tier: player.tier,
    topicSlugs: input.topicSlugs,
    count: input.count,
    timed: input.timed,
    seed,
    plan: planWithBank(
      (pool, s) => planSoloSession(pool, input.count, player.tier, s),
      generators,
      bank,
      seed,
    ),
  };

  const { data: session, error } = await admin
    .from("solo_sessions")
    .insert({ user_id: userId, settings })
    .select("id")
    .single();
  if (error) throw error;

  const current = await serveQuestion(admin, session.id, settings, 0, subjectId, topics);
  return {
    sessionId: session.id,
    count: settings.count,
    timed: settings.timed,
    secondsPerQuestion: SOLO_SECONDS_PER_QUESTION,
    score: 0,
    answered: 0,
    current,
    summary: null,
  };
}

async function loadSession(admin: Admin, userId: string, sessionId: string) {
  const { data, error } = await admin
    .from("solo_sessions")
    .select("id, settings, score, streak_best, finished_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "We couldn't find that practice session.");
  return { ...data, settings: SessionSettingsSchema.parse(data.settings) };
}

async function loadAnswers(admin: Admin, sessionId: string) {
  const { data, error } = await admin
    .from("answers")
    .select("is_correct, question_instances(topics(name))")
    .eq("solo_session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((a) => ({
    correct: a.is_correct,
    topicName: a.question_instances?.topics?.name ?? "Other",
  }));
}

function buildSummary(
  score: number,
  bestStreak: number,
  answersNewestFirst: { correct: boolean; topicName: string }[],
): SoloSummary {
  const inOrder = [...answersNewestFirst].reverse();
  return {
    score,
    correct: inOrder.filter((a) => a.correct).length,
    total: inOrder.length,
    bestStreak,
    topics: summariseByTopic(inOrder),
  };
}

export async function submitSoloAnswer(
  userId: string,
  input: { sessionId: string; instanceId: string; raw: string },
): Promise<SoloAnswerResult> {
  const receivedAt = Date.now();
  const admin = createAdminClient();
  const session = await loadSession(admin, userId, input.sessionId);
  if (session.finished_at) throw new ApiError(409, "This practice session has finished.");

  const { data: link, error: linkError } = await admin
    .from("solo_session_questions")
    .select(
      "idx, served_at, question_instances(marks, topic_id, question_secrets(answer_spec, solution))",
    )
    .eq("session_id", session.id)
    .eq("instance_id", input.instanceId)
    .maybeSingle();
  if (linkError) throw linkError;
  const instance = link?.question_instances;
  const secret = instance?.question_secrets;
  if (!link || !instance || !secret)
    throw new ApiError(404, "That question isn't part of this session.");

  const previous = await loadAnswers(admin, session.id);
  if (link.idx !== previous.length)
    throw new ApiError(409, "You've already answered this question.");

  const spec = AnswerSpecSchema.parse(secret.answer_spec);
  const solution = secret.solution as unknown as Solution;
  const result = check(spec, input.raw, instance.marks);
  const streak = nextStreak(currentStreak(previous.map((a) => a.correct)), result.correct);
  const elapsedMs = Math.max(0, receivedAt - Date.parse(link.served_at));
  const points = soloPoints({
    correct: result.correct,
    marksAwarded: result.marksAwarded,
    streakAfterThisAnswer: streak,
    timed: session.settings.timed
      ? { elapsedMs, secondsPerQuestion: SOLO_SECONDS_PER_QUESTION }
      : undefined,
  });
  const finished = link.idx + 1 >= session.settings.count;

  const { error: recordError } = await admin.rpc("record_solo_answer", {
    p_session_id: session.id,
    p_user_id: userId,
    p_instance_id: input.instanceId,
    p_topic_id: instance.topic_id,
    p_raw_answer: input.raw,
    p_is_correct: result.correct,
    p_marks_awarded: result.marksAwarded,
    p_points: points,
    p_time_ms: Math.min(elapsedMs, 2_000_000_000),
    p_streak: streak,
    p_finish: finished,
  });
  if (recordError) {
    if (recordError.code === "23505")
      throw new ApiError(409, "You've already answered this question.");
    if (recordError.code === "P0002")
      throw new ApiError(409, "This practice session has finished.");
    throw recordError;
  }

  const score = session.score + points;
  let next: SoloCurrentQuestion | null = null;
  let summary: SoloSummary | null = null;
  if (finished) {
    const answers = await loadAnswers(admin, session.id);
    summary = buildSummary(score, Math.max(session.streak_best, streak), answers);
  } else if (session.settings.mode === "daily") {
    // A daily attempt's questions are linked when it starts
    next = await linkedQuestion(admin, session.id, link.idx + 1);
  } else {
    const { subjectId, topics } = await loadSubjectAndTopics(admin);
    next = await serveQuestion(
      admin,
      session.id,
      session.settings,
      link.idx + 1,
      subjectId,
      topics,
    );
  }

  return {
    correct: result.correct,
    marksAwarded: result.marksAwarded,
    marks: instance.marks,
    points,
    ...(result.feedback ? { feedback: result.feedback } : {}),
    solution,
    score,
    streak,
    next,
    summary,
  };
}

/** The question already stored at slot `idx` of a session, if any. */
async function linkedQuestion(
  admin: Admin,
  sessionId: string,
  idx: number,
): Promise<SoloCurrentQuestion | null> {
  const { data, error } = await admin
    .from("solo_session_questions")
    .select("idx, instance_id, question_instances(public_payload)")
    .eq("session_id", sessionId)
    .eq("idx", idx)
    .maybeSingle();
  if (error) throw error;
  if (!data?.question_instances) return null;
  const payload = data.question_instances.public_payload as unknown as PublicPayload;
  return { index: data.idx, question: { instanceId: data.instance_id, ...payload } };
}

export async function getSoloState(userId: string, sessionId: string): Promise<SoloState> {
  const admin = createAdminClient();
  const session = await loadSession(admin, userId, sessionId);
  const answers = await loadAnswers(admin, session.id);

  const current = session.finished_at
    ? null
    : await linkedQuestion(admin, session.id, answers.length);

  return {
    sessionId: session.id,
    count: session.settings.count,
    timed: session.settings.timed,
    secondsPerQuestion: SOLO_SECONDS_PER_QUESTION,
    score: session.score,
    answered: answers.length,
    current,
    summary: session.finished_at ? buildSummary(session.score, session.streak_best, answers) : null,
  };
}
