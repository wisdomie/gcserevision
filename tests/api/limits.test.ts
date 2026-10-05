import { describe, expect, it } from "vitest";
import { clientIp, LIMITS, tooManyMessage } from "@/lib/api/limits";

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for address", () => {
    expect(clientIp(new Headers({ "x-real-ip": " 1.2.3.4 ", "x-forwarded-for": "5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": " , " }))).toBeNull();
  });
});

describe("LIMITS", () => {
  it("gives a whole class on one IP room to play", () => {
    for (const limits of Object.values(LIMITS)) {
      expect(limits.perUser.max).toBeGreaterThan(0);
      if ("perIp" in limits)
        expect(limits.perIp.max).toBeGreaterThanOrEqual(limits.perUser.max * 10);
    }
  });
});

describe("tooManyMessage", () => {
  it("is friendly and says how long to wait", () => {
    expect(tooManyMessage(20)).toBe("Slow down a little! Try again in a moment.");
    expect(tooManyMessage(61)).toContain("2 minutes");
    expect(tooManyMessage(60 * 1)).not.toContain("minute");
    expect(tooManyMessage(90)).toContain("2 minutes");
    expect(tooManyMessage(100 * 60 - 30)).toContain("100 minutes");
    expect(tooManyMessage(120)).toContain("2 minutes");
    expect(tooManyMessage(61 + 0)).toMatch(/minutes\.$/);
  });
});
