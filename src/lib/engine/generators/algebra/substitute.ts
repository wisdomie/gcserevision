import type { QuestionGenerator } from "../../types";
import { paren } from "../../util/algebra";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

interface Template {
  latex: (p: number, q: number) => string;
  substituted: (p: number, q: number, a: number, b: number) => string;
  value: (p: number, q: number, a: number, b: number) => number | null;
}

const TEMPLATES: Template[] = [
  {
    latex: (p, q) => `${p}a + ${q}b`,
    substituted: (p, q, a, b) => `${p} \\times ${paren(a)} + ${q} \\times ${paren(b)}`,
    value: (p, q, a, b) => p * a + q * b,
  },
  {
    latex: (p, q) => `${p}a - ${q}b`,
    substituted: (p, q, a, b) => `${p} \\times ${paren(a)} - ${q} \\times ${paren(b)}`,
    value: (p, q, a, b) => p * a - q * b,
  },
  {
    latex: (_p, q) => `a^{2} + ${q}b`,
    substituted: (_p, q, a, b) => `${paren(a)}^{2} + ${q} \\times ${paren(b)}`,
    value: (_p, q, a, b) => a * a + q * b,
  },
  {
    latex: (p) => `${p}(a + b)`,
    substituted: (p, _q, a, b) => `${p} \\times (${a} + ${paren(b)})`,
    value: (p, _q, a, b) => p * (a + b),
  },
  {
    latex: (_p, q) => `ab - ${q}`,
    substituted: (_p, q, a, b) => `${paren(a)} \\times ${paren(b)} - ${q}`,
    value: (_p, q, a, b) => a * b - q,
  },
  {
    latex: (p) => `\\frac{a + b}{${p}}`,
    substituted: (p, _q, a, b) => `\\frac{${a} + ${paren(b)}}{${p}}`,
    value: (p, _q, a, b) => ((a + b) % p === 0 ? (a + b) / p : null),
  },
];

export const substitute: QuestionGenerator = {
  key: "algebra.substitute",
  topicSlug: "substitution",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const t = rng.pick(TEMPLATES);
      const p = rng.int(2, 9);
      const q = rng.int(2, 9);
      const a = rng.int(-5, 10);
      const b = rng.int(-5, 10);
      if (a === 0 || b === 0) return null;
      const value = t.value(p, q, a, b);
      if (value === null || value === 0) return null;

      return {
        promptMd: `Work out the value of ${m(t.latex(p, q))} when ${m(`a = ${a}`)} and ${m(`b = ${b}`)}.`,
        inputType: "numeric",
        answerSpec: { kind: "integer", value },
        solution: {
          steps: [
            `Replace each letter with its value: ${m(t.substituted(p, q, a, b))}`,
            `Work it out, using the order of operations: ${m(`= ${value}`)}`,
          ],
          final: `${value}`,
        },
      };
    });
  },
};
