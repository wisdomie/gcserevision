import { describe, expect, it } from "vitest";
import { percent, topicReport, type TopicStat } from "@/lib/game/stats";

const stat = (slug: string, attempts: number, correct: number): TopicStat => ({
  slug,
  name: slug[0].toUpperCase() + slug.slice(1),
  attempts,
  correct,
});

describe("topicReport", () => {
  it("picks strongest and weakest by accuracy among judged topics", () => {
    const r = topicReport([
      stat("fractions", 10, 9),
      stat("ratio", 10, 3),
      stat("algebra", 5, 5),
      stat("averages", 4, 2),
      stat("surds", 2, 0), // not enough attempts to judge
      stat("unseen", 0, 0),
    ]);
    expect(r.strongest.map((s) => s.slug)).toEqual(["algebra", "fractions"]);
    expect(r.weakest.map((s) => s.slug)).toEqual(["ratio", "averages"]);
    expect(r.needMorePractice.map((s) => s.slug)).toEqual(["surds"]);
    expect(r.all.map((s) => s.slug)).toEqual([
      "algebra",
      "averages",
      "fractions",
      "ratio",
      "surds",
    ]);
  });

  it("never lists a topic as both strongest and weakest", () => {
    const one = topicReport([stat("fractions", 5, 5)]);
    expect(one.strongest.map((s) => s.slug)).toEqual(["fractions"]);
    expect(one.weakest).toEqual([]);
    const two = topicReport([stat("a", 5, 5), stat("b", 5, 1)]);
    expect(two.strongest.map((s) => s.slug)).toEqual(["a"]);
    expect(two.weakest.map((s) => s.slug)).toEqual(["b"]);
  });

  it("breaks ties on more attempts, then name", () => {
    const r = topicReport(
      [stat("b", 4, 4), stat("a", 4, 4), stat("c", 8, 8), stat("d", 4, 0), stat("e", 8, 0)],
      2,
    );
    expect(r.strongest.map((s) => s.slug)).toEqual(["c", "a"]);
    expect(r.weakest.map((s) => s.slug)).toEqual(["e", "d"]);
  });

  it("handles no data", () => {
    expect(topicReport([])).toEqual({ strongest: [], weakest: [], needMorePractice: [], all: [] });
  });

  it("caps accuracy at 100%", () => {
    expect(topicReport([stat("x", 3, 5)]).all[0].accuracy).toBe(1);
    expect(percent(2 / 3)).toBe("67%");
  });
});
