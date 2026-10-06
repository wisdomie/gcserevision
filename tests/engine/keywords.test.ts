import { describe, expect, it } from "vitest";
import { check, FEEDBACK } from "@/lib/engine/answers/check";
import { containsPhrase, sameWord, words } from "@/lib/engine/answers/keywords";
import { createRng } from "@/lib/engine/rng";
import { AnswerSpecSchema, INPUT_TYPE_FOR_KIND, type AnswerSpec } from "@/lib/engine/types";

const respiration: AnswerSpec = {
  kind: "keywords",
  groups: [["mitochondria", "mitochondrion"]],
};

describe("keyword matching", () => {
  it("splits answers into lower case words", () => {
    expect(words("  The Mitochondria! (it's) ")).toEqual(["the", "mitochondria", "it", "s"]);
    expect(words("naïve café")).toEqual(["naive", "cafe"]);
  });

  it("accepts plurals and one slip in longer words, but not different words", () => {
    expect(sameWord("enzymes", "enzyme")).toBe(true);
    expect(sameWord("capillaries", "capillary")).toBe(true);
    expect(sameWord("chlorophyl", "chlorophyll")).toBe(true);
    expect(sameWord("mitosis", "meiosis")).toBe(false);
    expect(sameWord("cell", "cells")).toBe(true);
    expect(sameWord("cel", "cell")).toBe(false); // short words must be exact
    expect(sameWord("h2o", "h20")).toBe(false); // no slips with digits
  });

  it("matches whole words and phrases only", () => {
    expect(containsPhrase(words("anaerobic respiration"), "aerobic")).toBe(false);
    expect(containsPhrase(words("it's the cell membrane"), "cell membrane")).toBe(true);
    expect(containsPhrase(words("membrane of the cell"), "cell membrane")).toBe(false);
    // "..." allows a few words in between, in order
    const diffusion = words(
      "from an area of higher concentration to an area of lower concentration",
    );
    expect(containsPhrase(diffusion, "higher ... lower")).toBe(true);
    expect(containsPhrase(diffusion, "lower ... higher")).toBe(false);
    expect(containsPhrase(words("higher a b c d e f g lower"), "higher ... lower")).toBe(false);
    expect(containsPhrase(words("high then high a b lower"), "high ... lower")).toBe(true);
  });
});

describe("keyword marking", () => {
  it("marks recall answers in many forms", () => {
    for (const raw of ["mitochondria", "The mitochondrion.", "In the MITOCHONDRIA", "mitocondria"])
      expect(check(respiration, raw).correct, raw).toBe(true);
    for (const raw of ["nucleus", "ribosomes", ""])
      expect(check(respiration, raw).correct).toBe(false);
  });

  it("gives a mark per point made, and full marks for `need` points", () => {
    const spec: AnswerSpec = {
      kind: "keywords",
      groups: [["oxygen"], ["glucose", "sugar"], ["carbon dioxide", "co2"]],
      need: 2,
    };
    expect(check(spec, "uses oxygen and glucose", 2)).toEqual({ correct: true, marksAwarded: 2 });
    expect(check(spec, "oxygen", 2)).toEqual({
      correct: false,
      marksAwarded: 1,
      feedback: "1 of 2 key points",
    });
    expect(check(spec, "water", 2)).toEqual({ correct: false, marksAwarded: 0 });
  });

  it("gives nothing for an answer that contradicts itself", () => {
    const spec: AnswerSpec = {
      kind: "keywords",
      groups: [["mitosis"]],
      reject: ["meiosis"],
    };
    expect(check(spec, "mitosis").correct).toBe(true);
    expect(check(spec, "mitosis or meiosis")).toEqual({
      correct: false,
      marksAwarded: 0,
      feedback: FEEDBACK.contradicts,
    });
  });

  it("only rejects phrases typed as written, not near misses", () => {
    const spec: AnswerSpec = { kind: "keywords", groups: [["ethene"]], reject: ["ethane"] };
    expect(check(spec, "ethene").correct).toBe(true);
    expect(check(spec, "ethane").correct).toBe(false);
    expect(check(spec, "ethenes").correct).toBe(true);
  });

  it("is answered in a text box and validated by the schema", () => {
    expect(INPUT_TYPE_FOR_KIND.keywords).toBe("text");
    expect(AnswerSpecSchema.safeParse({ kind: "keywords", groups: [["a"]], need: 2 }).success).toBe(
      false,
    );
    expect(AnswerSpecSchema.safeParse({ kind: "keywords", groups: [] }).success).toBe(false);
    expect(AnswerSpecSchema.safeParse(respiration).success).toBe(true);
  });

  it("never throws, whatever is typed", () => {
    const rng = createRng(7);
    const alphabet = "aeimnost cdhlr-'.!?é😀\n\t0123456789";
    for (let n = 0; n < 500; n++) {
      const raw = Array.from({ length: rng.int(0, 250) }, () => rng.pick([...alphabet])).join("");
      const r = check(respiration, raw, 1);
      expect(r.marksAwarded).toBeGreaterThanOrEqual(0);
      expect(r.marksAwarded).toBeLessThanOrEqual(1);
    }
  });
});
