// Pure solo-mode logic (PLAN.md M2). No Supabase or React imports.

import { z } from "zod";
import { MAX_ANSWER_LENGTH } from "@/lib/engine/answers/normalise";
import { createRng } from "@/lib/engine/rng";
import type {
  GeneratedQuestion,
  PublicQuestion,
  QuestionGenerator,
  Tier,
} from "@/lib/engine/types";

export const SOLO_COUNTS = [5, 10, 20] as const;
/** Time allowance per question when the optional solo timer is on. */
export const SOLO_SECONDS_PER_QUESTION = 60;

export const SoloStartSchema = z.object({
  topicSlugs: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(100),
  count: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  timed: z.boolean(),
});
export type SoloStartInput = z.infer<typeof SoloStartSchema>;

export const SoloAnswerSchema = z.object({
  sessionId: z.uuid(),
  instanceId: z.uuid(),
  raw: z.string().max(MAX_ANSWER_LENGTH),
});

/** One planned question: which generator and which seed. */
export interface PlannedQuestion {
  key: string;
  seed: number;
}

/** What is stored in `solo_sessions.settings`. */
export const SoloSettingsSchema = z.object({
  mode: z.literal("solo"),
  subject: z.string(),
  board: z.string().nullable(),
  tier: z.enum(["foundation", "higher"]),
  topicSlugs: z.array(z.string()),
  count: z.number().int().positive(),
  timed: z.boolean(),
  seed: z.number().int(),
  plan: z.array(z.object({ key: z.string(), seed: z.number().int() })),
});
export type SoloSettings = z.infer<typeof SoloSettingsSchema>;

/**
 * Chooses `count` questions from the eligible generators (PLAN.md 5.4).
 * Foundation draws evenly; Higher is weighted towards harder questions.
 * The same generator never appears twice in a row when there is a choice.
 * Deterministic for a given seed.
 */
export function planSoloSession(
  generators: readonly QuestionGenerator[],
  count: number,
  tier: Tier,
  seed: number,
): PlannedQuestion[] {
  if (generators.length === 0) throw new Error("planSoloSession: no eligible generators");
  const rng = createRng(seed);
  const weight = (g: QuestionGenerator) => (tier === "higher" ? g.difficulty : 1);

  const plan: PlannedQuestion[] = [];
  let previous: string | undefined;
  for (let i = 0; i < count; i++) {
    const pool = generators.length > 1 ? generators.filter((g) => g.key !== previous) : generators;
    const total = pool.reduce((sum, g) => sum + weight(g), 0);
    let r = rng.next() * total;
    let chosen = pool[pool.length - 1];
    for (const g of pool) {
      r -= weight(g);
      if (r < 0) {
        chosen = g;
        break;
      }
    }
    plan.push({ key: chosen.key, seed: rng.int(0, 2 ** 31 - 1) });
    previous = chosen.key;
  }
  return plan;
}

/** Current streak from answers newest-first: how many fully correct in a row. */
export function currentStreak(newestFirst: readonly boolean[]): number {
  const firstWrong = newestFirst.indexOf(false);
  return firstWrong === -1 ? newestFirst.length : firstWrong;
}

export type PublicPayload = Omit<PublicQuestion, "instanceId">;

/** The client-safe view of a question, stored as `question_instances.public_payload`. */
export function publicPayload(
  q: GeneratedQuestion,
  gen: Pick<QuestionGenerator, "marks" | "calculator">,
  topicName: string,
): PublicPayload {
  return {
    promptMd: q.promptMd,
    inputType: q.inputType,
    ...(q.options ? { options: q.options } : {}),
    ...(q.diagram ? { diagram: q.diagram } : {}),
    marks: gen.marks,
    calculator: gen.calculator,
    topicName,
  };
}

/** The client-safe view of a question. Never includes the answer or solution. */
export function toPublicQuestion(
  instanceId: string,
  q: GeneratedQuestion,
  gen: Pick<QuestionGenerator, "marks" | "calculator">,
  topicName: string,
): PublicQuestion {
  return { instanceId, ...publicPayload(q, gen, topicName) };
}

export interface TopicResult {
  topicName: string;
  attempted: number;
  correct: number;
}

/** Per-topic totals for the results screen, in first-seen order. */
export function summariseByTopic(
  answers: readonly { topicName: string; correct: boolean }[],
): TopicResult[] {
  const byTopic = new Map<string, TopicResult>();
  for (const a of answers) {
    const t = byTopic.get(a.topicName) ?? { topicName: a.topicName, attempted: 0, correct: 0 };
    t.attempted += 1;
    if (a.correct) t.correct += 1;
    byTopic.set(a.topicName, t);
  }
  return [...byTopic.values()];
}
