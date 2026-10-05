import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubEvent, scrubText, scrubUrl } from "@/lib/monitoring/scrub";

describe("error report scrubbing", () => {
  it("removes emails and query strings", () => {
    expect(scrubText("no user for sam.smith@school.org.uk here")).toBe("no user for [email] here");
    expect(scrubUrl("https://x.test/auth/callback?code=abc#t")).toBe(
      "https://x.test/auth/callback",
    );
  });

  it("drops the user, cookies, request bodies and console breadcrumbs", () => {
    const event = {
      type: undefined,
      message: "failed for a@b.co",
      user: { id: "u1", email: "a@b.co", ip_address: "1.2.3.4" },
      extra: { answer: "42" },
      server_name: "host-1",
      request: {
        method: "POST",
        url: "https://x.test/api/solo/answer?x=1",
        cookies: { "sb-access-token": "secret" },
        data: '{"raw":"42"}',
        headers: { cookie: "sb=secret", "user-agent": "Phone", "x-forwarded-for": "1.2.3.4" },
      },
      exception: { values: [{ type: "Error", value: "bad email a@b.co" }] },
      breadcrumbs: [
        { category: "console", message: "a@b.co" },
        {
          category: "fetch",
          data: { url: "https://x.test/api/rooms/join?c=1", method: "POST", body: "x" },
        },
      ],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.server_name).toBeUndefined();
    expect(out.request).toEqual({
      method: "POST",
      url: "https://x.test/api/solo/answer",
      headers: { "user-agent": "Phone" },
    });
    expect(out.message).toBe("failed for [email]");
    expect(out.exception?.values?.[0]?.value).toBe("bad email [email]");
    expect(out.breadcrumbs).toEqual([
      { category: "fetch", data: { url: "https://x.test/api/rooms/join", method: "POST" } },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/secret|1\.2\.3\.4|a@b\.co|"42"/);
  });
});
