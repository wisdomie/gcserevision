// Mixing hand-written bank questions into games (PLAN.md M8). Pure.
//
// Each bank question becomes a one-question "generator" (key `bank:<id>`), so
// tier, board, calculator and topic filtering work exactly as for generated
// questions. When planning, each topic's bank counts as a single choice next
// to that topic's generators, so a big bank doesn't crowd out the rest.
import type { BankQuestion } from "@/lib/content/bank";
import { createRng } from "@/lib/engine/rng";
import type { QuestionGenerator } from "@/lib/engine/types";
import type { PlannedQuestion } from "./solo";

export interface BankRow extends BankQuestion {
  id: string;
}

const BANK = "bank:";
const STAND_IN = "bank-topic:";

export const isBankKey = (key: string) => key.startsWith(BANK);

export function bankGenerator(row: BankRow): QuestionGenerator {
  return {
    key: `${BANK}${row.id}`,
    topicSlug: row.topicSlug,
    tiers: row.tier === "both" ? ["foundation", "higher"] : [row.tier],
    calculator: row.calculator,
    marks: row.marks,
    difficulty: row.difficulty,
    boards: row.boards,
    // Hand-written questions are fixed: the seed changes nothing
    generate: () => ({
      promptMd: row.promptMd,
      inputType: row.inputType,
      ...(row.options ? { options: row.options } : {}),
      answerSpec: row.answerSpec,
      solution: row.solution,
    }),
  };
}

/** One stand-in per topic for planning, and a way to swap the picks for real questions. */
export function bankStandIns(bank: readonly QuestionGenerator[]) {
  const byTopic = new Map<string, QuestionGenerator[]>();
  for (const q of bank) byTopic.set(q.topicSlug, [...(byTopic.get(q.topicSlug) ?? []), q]);

  const standIns: QuestionGenerator[] = [...byTopic].map(([topic, qs]) => {
    const difficulties = qs.map((q) => q.difficulty).sort((a, b) => a - b);
    return {
      ...qs[0]!,
      key: `${STAND_IN}${topic}`,
      difficulty: difficulties[Math.floor(difficulties.length / 2)]!,
    };
  });

  /** Replaces stand-in picks with bank questions, avoiding repeats while there are unused ones. */
  function resolve(plan: PlannedQuestion[], seed: number): PlannedQuestion[] {
    const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
    const used = new Set<string>();
    return plan.map((p) => {
      if (!p.key.startsWith(STAND_IN)) return p;
      const qs = byTopic.get(p.key.slice(STAND_IN.length))!;
      const fresh = qs.filter((q) => !used.has(q.key));
      const pick = rng.pick(fresh.length > 0 ? fresh : qs);
      used.add(pick.key);
      return { key: pick.key, seed: 0 };
    });
  }

  return { standIns, resolve };
}

/** Plans a game from generators plus bank questions (both already filtered). */
export function planWithBank(
  plan: (pool: QuestionGenerator[], seed: number) => PlannedQuestion[],
  generators: readonly QuestionGenerator[],
  bank: readonly QuestionGenerator[],
  seed: number,
): PlannedQuestion[] {
  const { standIns, resolve } = bankStandIns(bank);
  return resolve(plan([...generators, ...standIns], seed), seed);
}
