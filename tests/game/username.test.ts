import { describe, expect, it } from "vitest";
import { isAvatar } from "@/lib/profile/avatars";
import { ProfileInputSchema } from "@/lib/profile/schema";
import { checkUsername } from "@/lib/profile/username";

describe("checkUsername", () => {
  it.each(["maths_fox", "Sam2009", "abc", "x_y_z_123", "Essex_Kid", "classic_42", "Passion_Fruit"])(
    "allows %s",
    (name) => {
      expect(checkUsername(name)).toEqual({ ok: true });
    },
  );

  it.each(["ab", "a".repeat(21), "has space", "emoji🦊", "dash-name", ""])(
    "rejects the format of %j",
    (name) => {
      const r = checkUsername(name);
      expect(r.ok).toBe(false);
    },
  );

  it.each([
    "fuckface",
    "FUCK",
    "sh1thead",
    "b1tch_99",
    "xX_n4zi_Xx",
    "big_ass",
    "ass",
    "s3x",
    "tits_4u",
    "K1LL3R",
  ])("blocks %s", (name) => {
    expect(checkUsername(name)).toEqual({
      ok: false,
      reason: "Please choose a different username.",
    });
  });

  it("is strict on substrings: known false positives", () => {
    // Substring matching blocks some innocent names; acceptable for a children's app.
    expect(checkUsername("Dickens_fan").ok).toBe(false);
    expect(checkUsername("Scunthorpe1").ok).toBe(false);
  });
});

describe("profile input", () => {
  it("accepts a valid profile and preset avatars only", () => {
    expect(
      ProfileInputSchema.safeParse({
        username: "maths_fox",
        avatar: "🦊",
        board: "aqa",
        tier: "higher",
      }).success,
    ).toBe(true);
    expect(
      ProfileInputSchema.safeParse({ username: "x", avatar: "💩", board: "aqa", tier: "higher" })
        .success,
    ).toBe(false);
    expect(
      ProfileInputSchema.safeParse({ username: "x", avatar: "🦊", board: "cie", tier: "higher" })
        .success,
    ).toBe(false);
    expect(isAvatar("🦊")).toBe(true);
    expect(isAvatar("💩")).toBe(false);
  });
});
