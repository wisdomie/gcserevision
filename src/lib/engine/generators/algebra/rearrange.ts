import type { QuestionGenerator } from "../../types";
import { linear } from "../../util/algebra";
import { m } from "../../util/format";
import { retry } from "../../util/retry";

export const rearrange: QuestionGenerator = {
  key: "algebra.rearrange",
  topicSlug: "rearranging-formulae",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 2,
  difficulty: 3,
  boards: "all",
  generate(rng) {
    return retry(() => {
      const k = rng.int(2, 9);
      const c = rng.int(-12, 12);
      if (c === 0) return null;
      const sub = c > 0 ? "-" : "+";
      const abs = Math.abs(c);
      const variant = rng.pick(["linear", "fraction", "bracket", "perimeter"] as const);

      if (variant === "linear") {
        // y = kx + c  ->  x = (y - c) / k
        const answer = `\\frac{y ${sub} ${abs}}{${k}}`;
        return {
          promptMd: `Make ${m("x")} the subject of ${m(`y = ${linear(k, "x", c)}`)}`,
          inputType: "expression",
          answerSpec: { kind: "expression", latex: answer, variables: ["x", "y"] },
          solution: {
            steps: [
              `${c > 0 ? "Subtract" : "Add"} ${abs} ${c > 0 ? "from" : "to"} both sides: ${m(`y ${sub} ${abs} = ${k}x`)}`,
              `Divide both sides by ${k}: ${m(`x = ${answer}`)}`,
            ],
            final: m(`x = ${answer}`),
          },
        };
      }
      if (variant === "fraction") {
        // y = (x + c) / k  ->  x = ky - c
        const answer = linear(k, "y", -c);
        return {
          promptMd: `Make ${m("x")} the subject of ${m(`y = \\frac{${linear(1, "x", c)}}{${k}}`)}`,
          inputType: "expression",
          answerSpec: { kind: "expression", latex: answer, variables: ["x", "y"] },
          solution: {
            steps: [
              `Multiply both sides by ${k}: ${m(`${k}y = ${linear(1, "x", c)}`)}`,
              `${c > 0 ? "Subtract" : "Add"} ${abs} ${c > 0 ? "from" : "to"} both sides: ${m(`x = ${answer}`)}`,
            ],
            final: m(`x = ${answer}`),
          },
        };
      }
      if (variant === "bracket") {
        // y = k(x + c)  ->  x = y/k - c
        const answer = `\\frac{y}{${k}} ${sub} ${abs}`;
        return {
          promptMd: `Make ${m("x")} the subject of ${m(`y = ${k}(${linear(1, "x", c)})`)}`,
          inputType: "expression",
          answerSpec: { kind: "expression", latex: answer, variables: ["x", "y"] },
          solution: {
            steps: [
              `Divide both sides by ${k}: ${m(`\\frac{y}{${k}} = ${linear(1, "x", c)}`)}`,
              `${c > 0 ? "Subtract" : "Add"} ${abs} ${c > 0 ? "from" : "to"} both sides: ${m(`x = ${answer}`)}`,
            ],
            final: m(`x = ${answer}`),
          },
        };
      }
      // P = 2a + kb  ->  a = (P - kb) / 2
      const answer = `\\frac{P - ${k}b}{2}`;
      return {
        promptMd: `Make ${m("a")} the subject of ${m(`P = 2a + ${k}b`)}`,
        inputType: "expression",
        answerSpec: { kind: "expression", latex: answer, variables: ["a", "b", "P"] },
        solution: {
          steps: [
            `Subtract ${m(`${k}b`)} from both sides: ${m(`P - ${k}b = 2a`)}`,
            `Divide both sides by 2: ${m(`a = ${answer}`)}`,
          ],
          final: m(`a = ${answer}`),
        },
      };
    });
  },
};
