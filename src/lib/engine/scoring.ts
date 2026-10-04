// Scoring (PLAN.md 8). Pure functions; timestamps are milliseconds.

/** Latency allowance subtracted from elapsed time in live rooms. */
export const LATENCY_GRACE_MS = 300;
/** Answers received up to this long after `question_ends_at` are still accepted. */
export const LATE_GRACE_MS = 500;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Streak after this answer: +1 when fully correct, otherwise reset to 0. */
export function nextStreak(previous: number, correct: boolean): number {
  return correct ? previous + 1 : 0;
}

/** 0 for the first two in a row, then +100 per answer, capped at 500. */
export function streakBonus(streakAfterThisAnswer: number): number {
  return Math.min(500, 100 * Math.max(0, streakAfterThisAnswer - 2));
}

/** Time used for scoring: server receive time minus start, minus the latency grace, floored at 0. */
export function elapsedMs(receivedAt: number, questionStartedAt: number): number {
  return Math.max(0, receivedAt - questionStartedAt - LATENCY_GRACE_MS);
}

/** True if an answer arrived too late to count. */
export function isLate(receivedAt: number, questionEndsAt: number): boolean {
  return receivedAt > questionEndsAt + LATE_GRACE_MS;
}

/** 1 at the start down to 0.5 at the deadline. */
function speedFactor(elapsed: number, secondsPerQuestion: number): number {
  const fraction = clamp(elapsed / (secondsPerQuestion * 1000), 0, 1);
  return 1 - 0.5 * fraction;
}

export interface LiveAnswerScore {
  correct: boolean;
  marksAwarded: number;
  totalMarks: number;
  /** From `elapsedMs()`. */
  elapsedMs: number;
  secondsPerQuestion: number;
  /** From `nextStreak()`. */
  streakAfterThisAnswer: number;
}

/**
 * Live rooms and duels. Partial marks on multi-mark questions earn
 * proportional points; the streak bonus needs a fully correct answer.
 */
export function livePoints(a: LiveAnswerScore): number {
  if (a.marksAwarded <= 0 || a.totalMarks <= 0) return 0;
  const base = Math.round(1000 * speedFactor(a.elapsedMs, a.secondsPerQuestion));
  const partial = clamp(a.marksAwarded / a.totalMarks, 0, 1);
  return Math.round(base * partial) + (a.correct ? streakBonus(a.streakAfterThisAnswer) : 0);
}

export interface SoloAnswerScore {
  correct: boolean;
  marksAwarded: number;
  streakAfterThisAnswer: number;
  /** Set when the optional solo timer is on. */
  timed?: { elapsedMs: number; secondsPerQuestion: number };
}

/** Solo: 100 per mark (scaled by speed if timed) plus the streak bonus. */
export function soloPoints(a: SoloAnswerScore): number {
  if (a.marksAwarded <= 0) return 0;
  const factor = a.timed ? speedFactor(a.timed.elapsedMs, a.timed.secondsPerQuestion) : 1;
  return (
    Math.round(100 * a.marksAwarded * factor) +
    (a.correct ? streakBonus(a.streakAfterThisAnswer) : 0)
  );
}

export interface DuelStanding {
  score: number;
  /** Sum of `time_ms` across this player's correct answers. */
  correctTimeMs: number;
}

/** Sort comparator: higher score first, then lower total time on correct answers. */
export function compareDuel(a: DuelStanding, b: DuelStanding): number {
  return b.score - a.score || a.correctTimeMs - b.correctTimeMs;
}
