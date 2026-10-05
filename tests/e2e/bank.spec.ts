import { expect, test } from "@playwright/test";
import { adminClient, answerOnScreen, signUp } from "./helpers";

// PLAN.md M8: hand-written word problems are mixed into games and marked like the rest.
test.use({ viewport: { width: 360, height: 740 } });

test("word problems from the question bank turn up in solo practice", async ({ page }) => {
  await signUp(page, { tier: "Foundation" });
  await page.getByRole("link", { name: "Start practising" }).click();
  await page.getByRole("checkbox", { name: "Speed, density and pressure" }).check();
  await page.getByRole("button", { name: /^Start \(1 topic\)$/ }).click();
  await expect(page).toHaveURL(/\/play\/solo\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").pop()!;

  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Question ${i} of 10`)).toBeVisible();
    await answerOnScreen(page, true);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Correct!" })).toBeVisible();
    await page.getByRole("button", { name: i < 10 ? "Next question" : "See results" }).click();
  }
  await expect(page.getByText("10 / 10", { exact: true }).first()).toBeVisible();

  // At least one was a hand-written question (one topic: about half come from the bank)
  const { data } = await adminClient()
    .from("solo_session_questions")
    .select("question_instances(generator_key)")
    .eq("session_id", sessionId);
  const keys = (data ?? []).map(
    (r) => (r.question_instances as unknown as { generator_key: string }).generator_key,
  );
  expect(keys).toHaveLength(10);
  expect(keys.some((k) => k.startsWith("bank:"))).toBe(true);
});
