import type { QuestionGenerator } from "../../types";
import { m } from "../../util/format";
import { primeFactors } from "../../util/numbers";
import { retry } from "../../util/retry";

type Factors = [number, number][]; // [base, exponent]

function latex(factors: Factors): string {
  return [...factors]
    .filter(([, e]) => e > 0)
    .sort((x, y) => x[0] - y[0])
    .map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`))
    .join(" \\times ");
}

export const primeFactorDecomposition: QuestionGenerator = {
  key: "number.prime-factors",
  topicSlug: "factors-multiples-primes",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const count = rng.int(3, 5);
      let n = 1;
      for (let i = 0; i < count; i++) n *= rng.pick([2, 2, 2, 3, 3, 5, 7, 11]);
      if (n < 24 || n > 600) return null;
      const factors = primeFactors(n);
      if (factors.length < 2) return null;
      const correct = latex(factors);

      // Distractors from common mistakes
      const candidates: string[] = [];
      for (const [i, [p, e]] of factors.entries()) {
        const up = factors.map(([q, f], j): [number, number] => [q, j === i ? f + 1 : f]);
        const down = factors.map(([q, f], j): [number, number] => [q, j === i ? f - 1 : f]);
        candidates.push(latex(up), latex(down));
        // A square left as a composite number, e.g. 4 instead of 2^2
        if (e >= 2) {
          candidates.push(latex([...factors.filter(([q]) => q !== p), [p, e - 2], [p * p, 1]]));
        }
      }
      const seen = new Set([correct]);
      const distractors = rng
        .shuffle(candidates)
        .filter((c) => c !== "" && !seen.has(c) && seen.add(c))
        .slice(0, 3);
      if (distractors.length < 3) return null;

      const options = rng.shuffle([correct, ...distractors]);
      const divisions: string[] = [];
      let rest = n;
      for (const [p, e] of factors) {
        for (let k = 0; k < e; k++) {
          divisions.push(`${rest} \\div ${p} = ${rest / p}`);
          rest /= p;
        }
      }

      return {
        promptMd: `Write ${m(`${n}`)} as a product of its prime factors.\n\nChoose the answer in index form.`,
        inputType: "mcq",
        options: options.map(m),
        answerSpec: { kind: "mcq", correctIndex: options.indexOf(correct) },
        solution: {
          steps: [
            `Keep dividing by prime numbers: ${divisions.map(m).join(", ")}`,
            `Collect the primes and write repeated ones as powers: ${m(`${n} = ${correct}`)}`,
          ],
          final: m(correct),
        },
      };
    });
  },
};
