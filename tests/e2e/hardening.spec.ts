import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

// PLAN.md 11 and M8: rate limiting.
test("guessing room codes is rate limited per player", async ({ page }) => {
  await signUp(page);
  const statuses: number[] = [];
  let blocked: { status: number; retryAfter: string | null; body: { error: string } } | null = null;
  for (let i = 0; i < 25 && !blocked; i++) {
    const res = await page.request.post("/api/rooms/join", { data: { code: "ZZZZZZ" } });
    statuses.push(res.status());
    if (res.status() === 429)
      blocked = {
        status: 429,
        retryAfter: res.headers()["retry-after"] ?? null,
        body: await res.json(),
      };
  }
  // 20 tries are allowed (each finds no room), then the player has to wait
  expect(statuses.slice(0, 20).every((s) => s === 404)).toBe(true);
  expect(blocked).not.toBeNull();
  expect(Number(blocked!.retryAfter)).toBeGreaterThan(0);
  expect(blocked!.body.error).toMatch(/break|moment/);

  // Other actions have their own limits
  const start = await page.request.post("/api/daily/start");
  expect(start.status()).toBe(201);
});
