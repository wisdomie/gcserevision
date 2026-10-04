import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/api/redirect";

describe("safeRedirectPath", () => {
  it.each(["/play", "/play/solo?x=1", "/onboarding#top"])("allows %s", (p) =>
    expect(safeRedirectPath(p)).toBe(p),
  );

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "play",
    "/ /evil.com",
    "",
    null,
    undefined,
  ])("rejects %j", (p) => expect(safeRedirectPath(p)).toBe("/play"));
});
