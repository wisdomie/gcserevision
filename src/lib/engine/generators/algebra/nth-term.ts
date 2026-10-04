import type { QuestionGenerator } from "../../types";
import { linear, term } from "../../util/algebra";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

export const nthTerm: QuestionGenerator = {
  key: "algebra.nth-term",
  topicSlug: "sequences",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const d = rng.int(-6, 9);
      const first = rng.int(-10, 20);
      const c = first - d;
      if (d === 0 || d === 1 || c === 0 || Math.abs(d) === Math.abs(c)) return null;

      const terms = Array.from({ length: 5 }, (_, i) => first + i * d);
      const correct = linear(d, "n", c);
      // Distractors from common mistakes
      const mistakes = [
        linear(d, "n", first), // used the first term as the constant
        linear(1, "n", d), // n + difference
        linear(first, "n", d), // swapped the roles
        linear(d, "n", -c), // sign error on the constant
        linear(-d, "n", c), // sign error on the difference
      ];
      const seen = new Set([correct]);
      const distractors = rng
        .shuffle(mistakes)
        .filter((x) => !seen.has(x) && seen.add(x))
        .slice(0, 3);
      if (distractors.length < 3) return null;
      const options = rng.shuffle([correct, ...distractors]);

      return {
        promptMd: `Here are the first five terms of an arithmetic sequence:\n\n${m(terms.join(",\\; "))}\n\nWhich expression gives the ${m("n")}th term?`,
        inputType: "mcq",
        options: options.map(m),
        answerSpec: { kind: "mcq", correctIndex: options.indexOf(correct) },
        solution: {
          steps: [
            `The terms ${d > 0 ? "go up" : "go down"} by ${m(`${Math.abs(d)}`)} each time, so the ${m("n")}th term starts ${m(term(d, "n"))}.`,
            `When ${m("n = 1")}, ${m(`${term(d, "n")} = ${d}`)}, but the first term is ${m(`${first}`)}, so ${c > 0 ? "add" : "subtract"} ${m(`${Math.abs(c)}`)}.`,
            `Check with the second term: ${m(`${d} \\times 2 ${c < 0 ? "-" : "+"} ${Math.abs(c)} = ${terms[1]}`)}`,
          ],
          final: m(correct),
        },
      };
    });
  },
};
