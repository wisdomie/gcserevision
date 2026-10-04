import type { BoardSlug, CalcMode, QuestionGenerator, Tier } from "../types";
import { expandDouble, expandSingle } from "./algebra/expand";
import { factoriseCommon, factoriseQuadratic } from "./algebra/factorise";
import { nthTerm } from "./algebra/nth-term";
import { rearrange } from "./algebra/rearrange";
import { simplifyExpression } from "./algebra/simplify";
import { solveLinearTwoStep, solveUnknownBothSides } from "./algebra/solve-linear";
import { solveQuadratic } from "./algebra/solve-quadratic";
import { substitute } from "./algebra/substitute";
import { estimate } from "./number/estimate";
import { fractionsAdd } from "./number/fractions-add";
import { fractionsDivide } from "./number/fractions-divide";
import { fractionsMultiply } from "./number/fractions-multiply";
import { fractionsOfAmount } from "./number/fractions-of-amount";
import { highestCommonFactor } from "./number/hcf";
import { indexLaws } from "./number/indices";
import { lowestCommonMultiple } from "./number/lcm";
import { percentChange } from "./number/percent-change";
import { percentOf } from "./number/percent-of";
import { percentReverse } from "./number/percent-reverse";
import { primeFactorDecomposition } from "./number/prime-factors";
import { roundDecimalPlaces } from "./number/round-dp";
import { roundSignificantFigures } from "./number/round-sf";
import { standardFormCalc } from "./number/standard-form-calc";
import { standardFormConvert } from "./number/standard-form-convert";
import { probabilitySingleEvent } from "./probability/single-event";
import { probabilityTwoEventsAnd } from "./probability/two-events";
import { ratioShare } from "./ratio/share";
import { ratioSimplify } from "./ratio/simplify";
import { speedDistanceTime } from "./ratio/speed-distance-time";
import { mean, meanFromTotal, medianRange } from "./statistics/averages";

const ALL: readonly QuestionGenerator[] = [
  // Number
  fractionsAdd,
  fractionsMultiply,
  fractionsDivide,
  fractionsOfAmount,
  percentOf,
  percentChange,
  percentReverse,
  highestCommonFactor,
  lowestCommonMultiple,
  primeFactorDecomposition,
  roundDecimalPlaces,
  roundSignificantFigures,
  estimate,
  indexLaws,
  standardFormConvert,
  standardFormCalc,
  // Algebra
  simplifyExpression,
  expandSingle,
  expandDouble,
  factoriseCommon,
  factoriseQuadratic,
  rearrange,
  solveLinearTwoStep,
  solveUnknownBothSides,
  solveQuadratic,
  substitute,
  nthTerm,
  // Ratio
  ratioShare,
  ratioSimplify,
  speedDistanceTime,
  // Probability
  probabilitySingleEvent,
  probabilityTwoEventsAnd,
  // Statistics
  mean,
  medianRange,
  meanFromTotal,
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
