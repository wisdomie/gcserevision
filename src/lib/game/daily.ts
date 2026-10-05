// Pure daily-challenge logic (PLAN.md M6). No Supabase or React imports.

import { z } from "zod";
import { createRng } from "@/lib/engine/rng";
import type { QuestionGenerator } from "@/lib/engine/types";
import type { PlannedQuestion } from "./solo";

export const DAILY_COUNT = 5;
/** Days roll over at midnight UK time, like the weekly leaderboard. */
export const DAILY_TIME_ZONE = "Europe/London";

/** A daily date as YYYY-MM-DD. */
export const DailyDateSchema = z.iso.date();

/** The calendar date (YYYY-MM-DD) in the UK at `now`. */
export function dailyDate(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "Sunday 4 October" for headings and the share text. */
export function formatDailyDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** What is stored in `solo_sessions.settings` for a daily attempt. */
export const DailySettingsSchema = z.object({
  mode: z.literal("daily"),
  subject: z.string(),
  date: DailyDateSchema,
  count: z.number().int().positive(),
  timed: z.literal(false),
});
export type DailySettings = z.infer<typeof DailySettingsSchema>;

/**
 * The generators everyone can be asked: valid for both tiers and every board,
 * so the same five questions suit every player.
 */
export function dailyEligible(generators: readonly QuestionGenerator[]): QuestionGenerator[] {
  return generators.filter(
    (g) =>
      g.tiers.includes("foundation") &&
      g.tiers.includes("higher") &&
      g.boards === "all" &&
      !g.needsDiagram,
  );
}

/**
 * Chooses the day's questions: `count` generators from different topics where
 * possible, easiest first. Deterministic for a given seed.
 */
export function planDaily(
  generators: readonly QuestionGenerator[],
  seed: number,
  count = DAILY_COUNT,
): PlannedQuestion[] {
  if (generators.length === 0) throw new Error("planDaily: no eligible generators");
  const rng = createRng(seed);
  const shuffled = rng.shuffle(generators);
  const chosen: QuestionGenerator[] = [];
  const topics = new Set<string>();
  for (const g of shuffled) {
    if (chosen.length === count) break;
    if (!topics.has(g.topicSlug)) {
      chosen.push(g);
      topics.add(g.topicSlug);
    }
  }
  // Fewer topics than questions: top up with unused generators, then repeats
  for (const g of shuffled) {
    if (chosen.length === count) break;
    if (!chosen.includes(g)) chosen.push(g);
  }
  while (chosen.length < count) chosen.push(rng.pick(shuffled));

  return chosen
    .map((g, i) => ({ g, i }))
    .sort((a, b) => a.g.difficulty - b.g.difficulty || a.i - b.i)
    .map(({ g }) => ({ key: g.key, seed: rng.int(0, 2 ** 31 - 1) }));
}

export interface DailyShareInput {
  date: string;
  /** Per question, in order: fully right or not. */
  results: readonly boolean[];
  score: number;
  streak: number;
}

/** The copyable result card. Shows only right or wrong, never the questions or answers. */
export function dailyShareText({ date, results, score, streak }: DailyShareInput): string {
  const correct = results.filter(Boolean).length;
  const lines = [
    `Past Paper Game daily, ${formatDailyDate(date)}`,
    `${results.map((r) => (r ? "🟩" : "⬜")).join("")} ${correct}/${results.length}`,
    `${score} points`,
  ];
  if (streak >= 2) lines.push(`🔥 ${streak}-day streak`);
  return lines.join("\n");
}
