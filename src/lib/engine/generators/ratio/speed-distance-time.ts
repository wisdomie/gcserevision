import type { QuestionGenerator } from "../../types";
import { fmt, m } from "../../util/format";
import { clean } from "../../util/numbers";

const TIMES = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5] as const;
const TRAVELLERS = ["A car", "A coach", "A train", "A lorry", "A ferry"] as const;

/** 1 -> "1 hour", 1.5 -> "1.5 hours". */
const hours = (t: number) => `${fmt(t)} hour${t === 1 ? "" : "s"}`;

export const speedDistanceTime: QuestionGenerator = {
  key: "ratio.speed-distance-time",
  topicSlug: "compound-measures",
  tiers: ["foundation", "higher"],
  calculator: "either",
  marks: 2,
  difficulty: 2,
  boards: "all",
  generate(rng) {
    const traveller = rng.pick(TRAVELLERS);
    const speed = rng.int(6, 16) * 5;
    const time = rng.pick(TIMES);
    const distance = clean(speed * time);
    const find = rng.pick(["speed", "distance", "time"] as const);

    if (find === "speed") {
      return {
        promptMd: `${traveller} travels ${fmt(distance)} km in ${hours(time)}.\n\nWork out its average speed in km/h.`,
        inputType: "numeric",
        answerSpec: { kind: "decimal", value: speed, unit: "km/h" },
        solution: {
          steps: [`Speed = distance ÷ time`, m(`${fmt(distance)} \\div ${fmt(time)} = ${speed}`)],
          final: `${speed} km/h`,
        },
      };
    }
    if (find === "distance") {
      return {
        promptMd: `${traveller} travels at an average speed of ${speed} km/h for ${hours(time)}.\n\nHow far does it travel? Give your answer in km.`,
        inputType: "numeric",
        answerSpec: { kind: "decimal", value: distance, unit: "km" },
        solution: {
          steps: [`Distance = speed × time`, m(`${speed} \\times ${fmt(time)} = ${fmt(distance)}`)],
          final: `${fmt(distance)} km`,
        },
      };
    }
    return {
      promptMd: `${traveller} travels ${fmt(distance)} km at an average speed of ${speed} km/h.\n\nHow long does the journey take? Give your answer in hours.`,
      inputType: "numeric",
      answerSpec: { kind: "decimal", value: time, unit: "hours" },
      solution: {
        steps: [`Time = distance ÷ speed`, m(`${fmt(distance)} \\div ${speed} = ${fmt(time)}`)],
        final: `${fmt(time)} hours`,
      },
    };
  },
};
