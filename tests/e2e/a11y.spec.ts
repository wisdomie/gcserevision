import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { answerOnScreen, signUp } from "./helpers";

// PLAN.md M8: accessibility audit. Every main screen, in light and dark mode,
// must have no WCAG 2.1 A or AA violations that axe can find.
test.use({ viewport: { width: 360, height: 740 } });
test.describe.configure({ timeout: 120_000 });

async function audit(page: Page, name: string) {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    // Let the browser repaint in the new colour scheme before measuring
    // contrast. Chromium sometimes restyles a few elements a little later after
    // emulated media changes; players never switch scheme mid-screen like this.
    await page.waitForTimeout(300);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // MathLive's field and on-screen keyboard are third-party; see DECISIONS.md
      .exclude("math-field")
      .exclude(".ML__keyboard")
      .analyze();
    const summary = violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => `${n.target.join(" ")} ${JSON.stringify(n.any.map((a) => a.data))}`).join("\n  ")}`,
    );
    expect(summary, `${name} (${colorScheme})`).toEqual([]);
  }
}

test("signed-out pages", async ({ page }) => {
  for (const path of ["/", "/login", "/privacy", "/offline"]) {
    await page.goto(path);
    await audit(page, path);
  }
});

test("solo practice, daily, leaderboard and profile", async ({ page }) => {
  await signUp(page);
  await audit(page, "hub");

  await page.goto("/play/solo");
  await audit(page, "solo setup");

  // A question with a diagram, then its feedback, then the results
  await page.getByRole("checkbox", { name: "All geometry and measures topics" }).check();
  await page.getByText("5", { exact: true }).click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();
  await audit(page, "solo question");
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`Question ${i} of 5`)).toBeVisible();
    await answerOnScreen(page, i % 2 === 0);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
    if (i === 1) await audit(page, "solo feedback");
    await page.getByRole("button", { name: i < 5 ? "Next question" : "See results" }).click();
  }
  await expect(page.getByRole("heading", { name: "Your results" })).toBeVisible();
  await audit(page, "solo results");

  await page.goto("/play/daily");
  await expect(page.getByRole("button", { name: "Start today's challenge" })).toBeVisible();
  await audit(page, "daily intro");

  for (const path of [
    "/leaderboard",
    "/leaderboard?scope=friends",
    "/leaderboard?scope=daily",
    "/profile",
  ]) {
    await page.goto(path);
    await audit(page, path);
  }
});

test("live room screens", async ({ page, browser }) => {
  await signUp(page);
  await page.goto("/rooms/new");
  await audit(page, "new room");
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page).toHaveURL(/\/rooms\/[A-Z2-9]{6}$/);
  await audit(page, "lobby");

  const code = page.url().split("/").pop()!;
  const guestContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const guest = await guestContext.newPage();
  await signUp(guest);
  expect((await guest.request.post("/api/rooms/join", { data: { code } })).status()).toBe(200);
  await page.getByRole("button", { name: "Start the game" }).click();
  await expect(page.getByText(/Question 1 of/)).toBeVisible();
  await audit(page, "room question");
  await guestContext.close();
});
