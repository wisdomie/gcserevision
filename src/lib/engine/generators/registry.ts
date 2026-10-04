import type { BoardSlug, CalcMode, QuestionGenerator, Tier } from "../types";
import { fractionsAdd } from "./number/fractions-add";
import { fractionsMultiply } from "./number/fractions-multiply";
import { highestCommonFactor } from "./number/hcf";
import { lowestCommonMultiple } from "./number/lcm";
import { percentChange } from "./number/percent-change";
import { percentOf } from "./number/percent-of";
import { roundDecimalPlaces } from "./number/round-dp";
import { roundSignificantFigures } from "./number/round-sf";

const ALL: readonly QuestionGenerator[] = [
  fractionsAdd,
  fractionsMultiply,
  percentOf,
  percentChange,
  roundDecimalPlaces,
  roundSignificantFigures,
  highestCommonFactor,
  lowestCommonMultiple,
];

const BY_KEY = new Map<string, QuestionGenerator>();
for (const g of ALL) {
  if (BY_KEY.has(g.key)) throw new Error(`Duplicate generator key: ${g.key}`);
  BY_KEY.set(g.key, g);
}

export function getGenerator(key: string): QuestionGenerator | undefined {
  return BY_KEY.get(key);
}

export interface GeneratorFilter {
  tier?: Tier;
  /** Only generators valid for this board (those tagged 'all' always match). Omit for mixed-board rooms, which allow only 'all'. */
  board?: BoardSlug | null;
  topicSlugs?: readonly string[];
  /** The session's calculator rule: 'non-calc' excludes calculator-only generators. */
  calculator?: Exclude<CalcMode, "either">;
  includeDiagrams?: boolean;
}

/** Generators matching a game's settings (PLAN.md 5.4). */
export function listGenerators(filter: GeneratorFilter = {}): QuestionGenerator[] {
  return filterGenerators(ALL, filter);
}

export function filterGenerators(
  generators: readonly QuestionGenerator[],
  filter: GeneratorFilter,
): QuestionGenerator[] {
  return generators.filter((g) => {
    if (filter.tier && !g.tiers.includes(filter.tier)) return false;
    if (filter.board !== undefined) {
      if (
        filter.board === null
          ? g.boards !== "all"
          : g.boards !== "all" && !g.boards.includes(filter.board)
      ) {
        return false;
      }
    }
    if (filter.topicSlugs && filter.topicSlugs.length && !filter.topicSlugs.includes(g.topicSlug))
      return false;
    if (filter.calculator === "non-calc" && g.calculator === "calc") return false;
    if (!filter.includeDiagrams && g.needsDiagram) return false;
    return true;
  });
}
