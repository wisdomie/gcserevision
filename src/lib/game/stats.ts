// Topic strengths and weaknesses from topic_stats (PLAN.md M4). Pure.

export interface TopicStat {
  slug: string;
  name: string;
  attempts: number;
  correct: number;
}

export interface RankedTopic extends TopicStat {
  /** 0–1 */
  accuracy: number;
}

/** Fewer attempts than this and a topic isn't judged yet. */
export const MIN_ATTEMPTS = 3;

export interface TopicReport {
  strongest: RankedTopic[];
  weakest: RankedTopic[];
  /** Topics tried but not enough to judge. */
  needMorePractice: RankedTopic[];
  all: RankedTopic[];
}

/**
 * Ranks topics by accuracy. Strongest and weakest only use topics with enough
 * attempts, and a topic never appears in both lists. Ties break on more
 * attempts (more evidence), then name.
 */
export function topicReport(
  stats: readonly TopicStat[],
  count = 3,
  minAttempts = MIN_ATTEMPTS,
): TopicReport {
  const all = stats
    .filter((s) => s.attempts > 0)
    .map((s) => ({ ...s, accuracy: Math.min(1, s.correct / s.attempts) }));
  const judged = all.filter((s) => s.attempts >= minAttempts);

  const byStrength = [...judged].sort(
    (a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name),
  );
  const half = Math.min(count, Math.ceil(byStrength.length / 2));
  const strongest = byStrength.slice(0, half);
  const strongSlugs = new Set(strongest.map((s) => s.slug));
  const weakest = [...judged]
    .filter((s) => !strongSlugs.has(s.slug))
    .sort(
      (a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name),
    )
    .slice(0, count);

  return {
    strongest,
    weakest,
    needMorePractice: all
      .filter((s) => s.attempts < minAttempts)
      .sort((a, b) => a.name.localeCompare(b.name)),
    all: [...all].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export const percent = (accuracy: number) => `${Math.round(accuracy * 100)}%`;
