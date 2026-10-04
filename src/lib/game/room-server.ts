import "server-only";
import { randomInt } from "node:crypto";
import { ApiError } from "@/lib/api/handler";
import { check } from "@/lib/engine/answers/check";
import { getGenerator, listGenerators } from "@/lib/engine/generators/registry";
import { createRng, randomSeed } from "@/lib/engine/rng";
import { elapsedMs, isLate, LATE_GRACE_MS, livePoints, nextStreak } from "@/lib/engine/scoring";
import { AnswerSpecSchema, type PublicQuestion, type Solution } from "@/lib/engine/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import {
  canAdvance,
  canGoNext,
  generateRoomCode,
  normaliseRoomCode,
  rankPlayers,
  REVEAL_MS,
  type RoomMode,
  type RoomSettings,
  type RoomStatus,
  type RoomTiming,
} from "./room";
import type { RevealResult, RoomReveal, RoomState } from "./room-types";
import { planSoloSession, publicPayload, type PublicPayload } from "./solo";
import { loadSubjectAndTopics } from "./solo-server";

type Admin = ReturnType<typeof createAdminClient>;

const asJson = (value: object) => value as unknown as Json;
const ms = (t: string | null) => (t ? Date.parse(t) : null);

/** A Postgres error code raised by the room functions (see the live_rooms migration). */
function pgCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

const NOT_FOUND = "We couldn't find a room with that code. Check it and try again.";

async function loadRoom(admin: Admin, rawCode: string) {
  const code = normaliseRoomCode(rawCode);
  if (!code) throw new ApiError(404, NOT_FOUND);
  const { data, error } = await admin.from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, NOT_FOUND);
  return data;
}
type Room = Awaited<ReturnType<typeof loadRoom>>;

async function requireMember(admin: Admin, roomId: string, userId: string) {
  const { data, error } = await admin
    .from("room_players")
    .select("user_id, streak, answered_idx")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(403, "You're not in this room. Join it with its code first.");
  return data;
}

function timing(room: Room): RoomTiming {
  return {
    status: room.status as RoomStatus,
    currentIndex: room.current_index,
    questionEndsAt: ms(room.question_ends_at),
    revealStartedAt: ms(room.reveal_started_at),
  };
}

async function instanceAt(admin: Admin, roomId: string, idx: number) {
  const { data, error } = await admin
    .from("room_questions")
    .select("instance_id")
    .eq("room_id", roomId)
    .eq("idx", idx)
    .maybeSingle();
  if (error) throw error;
  return data?.instance_id ?? null;
}

// ---------------------------------------------------------------------------
// Create and join
// ---------------------------------------------------------------------------

export async function createRoom(
  userId: string,
  settings: RoomSettings,
): Promise<{ code: string }> {
  const admin = createAdminClient();

  // Cleanup runs lazily here rather than on a schedule (DECISIONS.md, M5)
  const { error: expireError } = await admin.rpc("expire_idle_rooms");
  if (expireError) throw expireError;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new ApiError(409, "Finish setting up your profile first.");

  const { subjectId, topics } = await loadSubjectAndTopics(admin);
  let boardId: number | null = null;
  if (settings.board) {
    const { data: board, error } = await admin
      .from("exam_boards")
      .select("id")
      .eq("slug", settings.board)
      .single();
    if (error) throw error;
    boardId = board.id;
  }

  const generators = listGenerators({
    tier: settings.tier,
    board: settings.board,
    topicSlugs: settings.topicSlugs,
  }).filter((g) => topics.has(g.topicSlug));
  if (generators.length === 0)
    throw new ApiError(400, "There are no questions for those settings yet.");

  const plan = planSoloSession(generators, settings.questionCount, settings.tier, randomSeed());
  const questions = plan.map(({ key, seed }) => {
    const gen = getGenerator(key)!;
    const topic = topics.get(gen.topicSlug)!;
    const q = gen.generate(createRng(seed));
    return {
      topic_id: topic.id,
      generator_key: gen.key,
      seed,
      calculator: gen.calculator,
      marks: gen.marks,
      public_payload: publicPayload(q, gen, topic.name),
      answer_spec: q.answerSpec,
      solution: q.solution,
    };
  });
  const topicIds = [...new Set(settings.topicSlugs.map((s) => topics.get(s)?.id))].filter(
    (id): id is number => id !== undefined,
  );

  // A fresh code collides with a live one rarely; try again if it does
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode(() => randomInt(0, 2 ** 32) / 2 ** 32);
    const { error } = await admin.rpc("create_room", {
      p_code: code,
      p_host_id: userId,
      p_mode: settings.mode,
      p_subject_id: subjectId,
      p_exam_board_id: boardId as number,
      p_tier: settings.tier,
      p_topic_ids: topicIds,
      p_seconds_per_question: settings.secondsPerQuestion,
      p_questions: asJson(questions),
    });
    if (!error) return { code };
    if (pgCode(error) !== "23505") throw error;
  }
  throw new Error("Could not find a free room code");
}

export async function joinRoom(userId: string, rawCode: string): Promise<{ code: string }> {
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  const { data: players, error } = await admin.rpc("join_room", {
    p_room_id: room.id,
    p_user_id: userId,
  });
  if (error) {
    const code = pgCode(error);
    if (code === "PR001") throw new ApiError(409, "This game has already started.");
    if (code === "PR002") throw new ApiError(409, "This room is full.");
    if (code === "23503") throw new ApiError(409, "Finish setting up your profile first.");
    throw error;
  }
  // A duel starts by itself as soon as both players are in
  if (room.mode === "duel" && players >= room.max_players) {
    const { error: startError } = await admin.rpc("start_room", {
      p_room_id: room.id,
      p_user_id: null as unknown as string,
    });
    if (startError) throw startError;
  }
  return { code: room.code! };
}

// ---------------------------------------------------------------------------
// The game: start, answer, advance (close the question), next, leave
// ---------------------------------------------------------------------------

export async function startRoom(userId: string, rawCode: string): Promise<{ started: boolean }> {
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  await requireMember(admin, room.id, userId);
  if (room.status !== "lobby") return { started: false };

  const { count, error: countError } = await admin
    .from("room_players")
    .select("user_id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if (countError) throw countError;
  if ((count ?? 0) < 2) throw new ApiError(409, "Wait for at least one friend to join.");

  const { data: started, error } = await admin.rpc("start_room", {
    p_room_id: room.id,
    p_user_id: userId,
  });
  if (error) {
    if (pgCode(error) === "PR005") throw new ApiError(403, "Only the host can start the game.");
    if (pgCode(error) === "PR003") throw new ApiError(403, "You're not in this room.");
    throw error;
  }
  return { started };
}

export async function submitRoomAnswer(
  userId: string,
  rawCode: string,
  input: { instanceId: string; raw: string },
): Promise<{ accepted: true }> {
  const receivedAt = Date.now();
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  const player = await requireMember(admin, room.id, userId);

  const idx = room.current_index;
  const closed = new ApiError(409, "This question has closed.");
  if (room.status !== "question" || !room.question_started_at || !room.question_ends_at)
    throw closed;
  if ((await instanceAt(admin, room.id, idx)) !== input.instanceId) throw closed;
  if (isLate(receivedAt, Date.parse(room.question_ends_at)))
    throw new ApiError(409, "Time's up for this question.");
  if (player.answered_idx >= idx) throw new ApiError(409, "You've already answered this question.");

  const { data: instance, error: instanceError } = await admin
    .from("question_instances")
    .select("marks, question_secrets(answer_spec)")
    .eq("id", input.instanceId)
    .single();
  if (instanceError) throw instanceError;
  if (!instance.question_secrets) throw new Error(`No secret for instance ${input.instanceId}`);

  const spec = AnswerSpecSchema.parse(instance.question_secrets.answer_spec);
  const result = check(spec, input.raw, instance.marks);
  const elapsed = elapsedMs(receivedAt, Date.parse(room.question_started_at));
  const points = livePoints({
    correct: result.correct,
    marksAwarded: result.marksAwarded,
    totalMarks: instance.marks,
    elapsedMs: elapsed,
    secondsPerQuestion: room.seconds_per_question,
    streakAfterThisAnswer: nextStreak(player.streak, result.correct),
  });

  const { error } = await admin.rpc("record_room_answer", {
    p_room_id: room.id,
    p_user_id: userId,
    p_idx: idx,
    p_instance_id: input.instanceId,
    p_raw_answer: input.raw,
    p_is_correct: result.correct,
    p_marks_awarded: result.marksAwarded,
    p_points: points,
    p_time_ms: Math.min(elapsed, 2_000_000_000),
  });
  if (error) {
    const code = pgCode(error);
    if (code === "23505") throw new ApiError(409, "You've already answered this question.");
    if (code === "PR004") throw closed;
    if (code === "PR003") throw new ApiError(403, "You're not in this room.");
    throw error;
  }

  // The last player in closes the question straight away
  await tryAdvance(admin, room.id, idx);
  return { accepted: true };
}

/** Closes question `fromIndex` if its time is up or everyone has answered. Safe to repeat. */
async function tryAdvance(admin: Admin, roomId: string, fromIndex: number): Promise<boolean> {
  const { data: room, error } = await admin.from("rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  const { data: players, error: playersError } = await admin
    .from("room_players")
    .select("answered_idx")
    .eq("room_id", roomId);
  if (playersError) throw playersError;
  const answered = players.filter((p) => p.answered_idx >= fromIndex).length;
  // Late answers are accepted for LATE_GRACE_MS, so wait that long before closing on time
  if (!canAdvance(timing(room), fromIndex, Date.now() - LATE_GRACE_MS, answered, players.length))
    return false;
  const { data: done, error: finalizeError } = await admin.rpc("finalize_question", {
    p_room_id: roomId,
    p_idx: fromIndex,
  });
  if (finalizeError) throw finalizeError;
  return done;
}

export async function advanceRoom(
  userId: string,
  rawCode: string,
  fromIndex: number,
): Promise<{ advanced: boolean }> {
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  await requireMember(admin, room.id, userId);
  return { advanced: await tryAdvance(admin, room.id, fromIndex) };
}

export async function nextInRoom(
  userId: string,
  rawCode: string,
  fromIndex: number,
): Promise<{ moved: boolean }> {
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  await requireMember(admin, room.id, userId);
  if (!canGoNext(timing(room), fromIndex, Date.now())) return { moved: false };
  const { data: moved, error } = await admin.rpc("next_question", {
    p_room_id: room.id,
    p_idx: fromIndex,
  });
  if (error) throw error;
  return { moved };
}

export async function leaveRoom(userId: string, rawCode: string): Promise<{ left: true }> {
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  const { error } = await admin.rpc("leave_room", { p_room_id: room.id, p_user_id: userId });
  if (error) throw error;
  return { left: true };
}

// ---------------------------------------------------------------------------
// Reading the room
// ---------------------------------------------------------------------------

/** Question `idx` has closed: its answers and solution can be shown. */
function isClosed(room: Room, idx: number): boolean {
  return idx < room.current_index || (idx === room.current_index && room.status !== "question");
}

export async function getRoomState(userId: string, rawCode: string): Promise<RoomState> {
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  const me = await requireMember(admin, room.id, userId);

  const [playersRes, questionsRes, answersRes] = await Promise.all([
    admin
      .from("room_players")
      .select("user_id, score, answered_idx, joined_at, profiles(username, avatar)")
      .eq("room_id", room.id)
      .order("joined_at"),
    admin.from("room_questions").select("idx, instance_id").eq("room_id", room.id),
    admin
      .from("answers")
      .select("user_id, instance_id, time_ms")
      .eq("room_id", room.id)
      .eq("is_correct", true),
  ]);
  for (const res of [playersRes, questionsRes, answersRes]) if (res.error) throw res.error;
  const roomQuestions = questionsRes.data!;
  const instanceIdx = new Map(roomQuestions.map((q) => [q.instance_id, q.idx]));

  // Duel tie-break time, over closed questions only so nothing leaks mid-question
  const correctTime = new Map<string, number>();
  for (const a of answersRes.data!) {
    const idx = instanceIdx.get(a.instance_id);
    if (idx === undefined || !isClosed(room, idx)) continue;
    correctTime.set(a.user_id, (correctTime.get(a.user_id) ?? 0) + (a.time_ms ?? 0));
  }

  const status = room.status as RoomStatus;
  const players = rankPlayers(
    playersRes.data!.map((p) => ({
      userId: p.user_id,
      username: p.profiles?.username ?? "Player",
      avatar: p.profiles?.avatar ?? null,
      score: p.score,
      correctTimeMs: correctTime.get(p.user_id) ?? 0,
      isHost: p.user_id === room.host_id,
      answered: status === "question" && p.answered_idx >= room.current_index,
    })),
  );

  let question: PublicQuestion | null = null;
  if (status === "question" || status === "reveal") {
    const instanceId = roomQuestions.find((q) => q.idx === room.current_index)?.instance_id;
    if (instanceId) {
      const { data, error } = await admin
        .from("question_instances")
        .select("public_payload")
        .eq("id", instanceId)
        .single();
      if (error) throw error;
      question = { instanceId, ...(data.public_payload as unknown as PublicPayload) };
    }
  }

  return {
    roomId: room.id,
    code: room.code!,
    mode: room.mode as RoomMode,
    status,
    currentIndex: room.current_index,
    questionCount: room.question_count,
    secondsPerQuestion: room.seconds_per_question,
    maxPlayers: room.max_players,
    questionStartedAt: ms(room.question_started_at),
    questionEndsAt: ms(room.question_ends_at),
    revealStartedAt: ms(room.reveal_started_at),
    revealMs: REVEAL_MS,
    me: userId,
    isHost: room.host_id === userId,
    players,
    question,
    answered: me.answered_idx >= room.current_index && status !== "lobby",
    serverNow: Date.now(),
  };
}

export async function getReveal(userId: string, rawCode: string, idx: number): Promise<RoomReveal> {
  const admin = createAdminClient();
  const room = await loadRoom(admin, rawCode);
  await requireMember(admin, room.id, userId);
  if (!isClosed(room, idx)) throw new ApiError(409, "This question hasn't closed yet.");

  const instanceId = await instanceAt(admin, room.id, idx);
  if (!instanceId) throw new ApiError(404, "That question isn't part of this room.");

  const [secretRes, answersRes, playersRes] = await Promise.all([
    admin.from("question_secrets").select("solution").eq("instance_id", instanceId).single(),
    admin
      .from("answers")
      .select("user_id, raw_answer, is_correct, marks_awarded, points")
      .eq("room_id", room.id)
      .eq("instance_id", instanceId),
    admin
      .from("room_players")
      .select("user_id, profiles(username, avatar)")
      .eq("room_id", room.id)
      .order("joined_at"),
  ]);
  for (const res of [secretRes, answersRes, playersRes]) if (res.error) throw res.error;

  const answers = new Map(answersRes.data!.map((a) => [a.user_id, a]));
  const results: RevealResult[] = playersRes.data!.map((p) => {
    const a = answers.get(p.user_id);
    return {
      userId: p.user_id,
      username: p.profiles?.username ?? "Player",
      avatar: p.profiles?.avatar ?? null,
      answered: !!a,
      correct: a?.is_correct ?? false,
      marksAwarded: a?.marks_awarded ?? 0,
      points: a?.points ?? 0,
    };
  });
  results.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));

  return {
    index: idx,
    solution: secretRes.data!.solution as unknown as Solution,
    myAnswer: answers.get(userId)?.raw_answer ?? null,
    results,
  };
}
