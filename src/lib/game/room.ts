// Pure live-room logic (PLAN.md 10). No Supabase or React imports.

import { z } from "zod";
import { MAX_ANSWER_LENGTH } from "@/lib/engine/answers/normalise";
import { compareDuel } from "@/lib/engine/scoring";
import { BOARD_SLUGS, TIERS } from "@/lib/engine/types";
import { SubjectSlugSchema } from "./subjects";

/** No O, 0, I, 1 or L: easy to read out and type on a phone. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYERS = { room: 20, duel: 2 } as const;
/** How long the answer and scores show before the next question. */
export const REVEAL_MS = 6000;

export type RoomMode = keyof typeof MAX_PLAYERS;
export type RoomStatus = "lobby" | "question" | "reveal" | "finished";

/** A random room code. `random` returns [0, 1); pass a CSPRNG-backed one on the server. */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercases and strips spaces and dashes; returns null if it can't be a room code. */
export function normaliseRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null;
}

const slug = z.string().regex(/^[a-z0-9-]{1,60}$/);

export const RoomSettingsSchema = z.object({
  mode: z.enum(["room", "duel"]),
  subject: SubjectSlugSchema.default("maths"),
  /** null = mixed boards: only questions valid for every board */
  board: z.enum(BOARD_SLUGS).nullable(),
  tier: z.enum(TIERS),
  topicSlugs: z.array(slug).max(100),
  questionCount: z.number().int().min(3).max(20),
  secondsPerQuestion: z.number().int().min(10).max(90),
});
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

export const JoinRoomSchema = z.object({ code: z.string().max(20) });
export const RoomAnswerSchema = z.object({
  instanceId: z.uuid(),
  raw: z.string().max(MAX_ANSWER_LENGTH),
});
export const FromIndexSchema = z.object({ fromIndex: z.number().int().min(0).max(100) });

export interface RoomTiming {
  status: RoomStatus;
  currentIndex: number;
  /** ms since epoch */
  questionEndsAt: number | null;
  revealStartedAt: number | null;
}

/**
 * A question can close once its timer has run out or every player has
 * answered. Guarded on the index so repeated calls are harmless.
 */
export function canAdvance(
  room: RoomTiming,
  fromIndex: number,
  now: number,
  answered: number,
  players: number,
): boolean {
  if (room.status !== "question" || room.currentIndex !== fromIndex) return false;
  const timeUp = room.questionEndsAt !== null && now >= room.questionEndsAt;
  const allIn = players > 0 && answered >= players;
  return timeUp || allIn;
}

/** The reveal moves on after REVEAL_MS. */
export function canGoNext(room: RoomTiming, fromIndex: number, now: number): boolean {
  return (
    room.status === "reveal" &&
    room.currentIndex === fromIndex &&
    room.revealStartedAt !== null &&
    now >= room.revealStartedAt + REVEAL_MS
  );
}

export interface Standing {
  userId: string;
  username: string;
  avatar: string | null;
  score: number;
  /** Total time_ms over correct answers (duel tie-break). */
  correctTimeMs: number;
}

export interface Ranked extends Standing {
  /** 1-based; tied players share a rank. */
  rank: number;
}

/** Highest score first; ties broken by less time on correct answers; then name for a stable order. */
export function rankPlayers<T extends Standing>(standings: readonly T[]): (T & { rank: number })[] {
  const sorted = [...standings].sort(
    (a, b) => compareDuel(a, b) || a.username.localeCompare(b.username),
  );
  let rank = 0;
  return sorted.map((s, i) => {
    const prev = sorted[i - 1];
    if (!prev || compareDuel(prev, s) !== 0) rank = i + 1;
    return { ...s, rank };
  });
}
