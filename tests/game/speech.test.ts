import { describe, expect, it } from "vitest";
import { mathToSpeech } from "@/lib/math/speech";

describe("mathToSpeech", () => {
  it("reads common answer options aloud", () => {
    expect(mathToSpeech("$\\frac{1}{2}$")).toBe("1 over 2");
    expect(mathToSpeech("$y = -3x + 3$")).toBe("y = minus 3x + 3");
    expect(mathToSpeech("$1.5 \\times 10^{8}$ km")).toBe("1.5 times 10 to the power 8 km");
    expect(mathToSpeech("$t = \\frac{v - u}{a}$")).toBe("t = v minus u over a");
    expect(mathToSpeech("$2^{3} \\times 3^2$")).toBe("2 cubed times 3 squared");
    expect(mathToSpeech("$\\sqrt{2}$")).toBe("square root of 2");
    expect(mathToSpeech("45^{\\circ}")).toBe("45 degrees");
    expect(mathToSpeech("Shop A, by £1.50")).toBe("Shop A, by £1.50");
  });
});
