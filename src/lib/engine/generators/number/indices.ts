import type { QuestionGenerator } from "../../types";
import { m } from "../../util/format";

export const indexLaws: QuestionGenerator = {
  key: "number.indices.laws",
  topicSlug: "powers-roots",
  tiers: ["foundation", "higher"],
  calculator: "non-calc",
  marks: 1,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    const base = rng.int(2, 9);
    const law = rng.pick(["multiply", "divide", "power"] as const);
    let p = rng.int(2, 9);
    let q = rng.int(2, 9);
    if (law === "divide" && p <= q) p = q + rng.int(1, 5);
    if (law === "power") q = rng.int(2, 5);

    const n = law === "multiply" ? p + q : law === "divide" ? p - q : p * q;
    const expr =
      law === "multiply"
        ? `${base}^{${p}} \\times ${base}^{${q}}`
        : law === "divide"
          ? `${base}^{${p}} \\div ${base}^{${q}}`
          : `(${base}^{${p}})^{${q}}`;
    const rule =
      law === "multiply"
        ? `When multiplying powers of the same number, add the indices: ${m(`${p} + ${q} = ${n}`)}`
        : law === "divide"
          ? `When dividing powers of the same number, subtract the indices: ${m(`${p} - ${q} = ${n}`)}`
          : `When raising a power to a power, multiply the indices: ${m(`${p} \\times ${q} = ${n}`)}`;

    return {
      promptMd: `${m(`${expr} = ${base}^{n}`)}\n\nWork out the value of ${m("n")}.`,
      inputType: "numeric",
      answerSpec: { kind: "integer", value: n },
      solution: { steps: [rule, `So ${m(`${expr} = ${base}^{${n}}`)}`], final: `${n}` },
    };
  },
};
