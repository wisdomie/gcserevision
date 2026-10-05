// Marking short written answers on key terms (PLAN.md M9), for recall
// questions such as "Name the organelle where respiration happens".
//
// Matching is deliberately forgiving about form and strict about meaning:
// - case, punctuation and extra spaces are ignored;
// - a plural or simple ending is accepted ("enzymes" for "enzyme");
// - one wrong letter is forgiven in longer words ("chlorophyl"), as exam
//   boards don't penalise spelling unless it changes the word;
// - words are matched whole, so "aerobic" doesn't match inside "anaerobic".

/** Lower case words, with everything but letters and digits treated as spaces. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

const ENDINGS = ["s", "es", "ies"];

/** Levenshtein distance, stopping early once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Whether a typed word counts as the expected word; `fuzzy` forgives one slip. */
export function sameWord(typed: string, expected: string, fuzzy = true): boolean {
  if (typed === expected) return true;
  // Plurals and simple endings, both ways ("enzyme"/"enzymes", "capillary"/"capillaries")
  for (const end of ENDINGS) {
    if (typed === expected + end || expected === typed + end) return true;
    if (end === "ies" && expected.endsWith("y") && typed === expected.slice(0, -1) + end)
      return true;
    if (end === "ies" && typed.endsWith("y") && expected === typed.slice(0, -1) + end) return true;
  }
  // One slip in a longer word; digits must match exactly
  if (!fuzzy) return false;
  return expected.length >= 6 && !/\d/.test(expected + typed) && distance(typed, expected, 1) <= 1;
}

/** Most words allowed between the parts of a phrase written "a ... b". */
export const MAX_GAP = 6;

/** Where `target` starts in `answer` at or after `from`, as consecutive words; -1 if nowhere. */
function findRun(
  answer: string[],
  target: string[],
  from: number,
  to: number,
  fuzzy: boolean,
): number {
  for (let i = from; i <= to && i + target.length <= answer.length; i++) {
    if (target.every((w, k) => sameWord(answer[i + k], w, fuzzy))) return i;
  }
  return -1;
}

/**
 * Whether `phrase` appears in the answer as whole words. Words must be
 * consecutive, except that "..." allows up to MAX_GAP words in between:
 * "higher ... lower" matches "from a higher concentration to a lower one".
 */
export function containsPhrase(answer: string[], phrase: string, fuzzy = true): boolean {
  const parts = phrase
    .split("...")
    .map(words)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  const match = (part: number, from: number, to: number): boolean => {
    for (let start = from; start <= to; start++) {
      const at = findRun(answer, parts[part], start, to, fuzzy);
      if (at < 0) return false;
      const end = at + parts[part].length;
      if (part === parts.length - 1 || match(part + 1, end, end + MAX_GAP)) return true;
      start = at;
    }
    return false;
  };
  return match(0, 0, answer.length);
}

export interface KeywordMatch {
  /** How many marking points the answer hit. */
  matched: number;
  /** Whether it contains a rejected phrase. */
  rejected: boolean;
}

export function matchKeywords(
  raw: string,
  spec: { groups: string[][]; reject?: string[] },
): KeywordMatch {
  const answer = words(raw);
  return {
    matched: spec.groups.filter((g) => g.some((p) => containsPhrase(answer, p))).length,
    // Rejected phrases must be typed as written: a slip in "ethene" isn't "ethane"
    rejected: (spec.reject ?? []).some((p) => containsPhrase(answer, p, false)),
  };
}
