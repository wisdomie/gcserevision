import { expect, test } from "@playwright/test";
import { adminClient, answerOnScreen, expectNoHorizontalScroll, signUp } from "./helpers";

// PLAN.md M6: the daily challenge, its streak, friends board and share card.
test.use({ viewport: { width: 360, height: 740 } });

test("two friends play the same daily challenge and compare results", async ({
  page: alice,
  browser,
}) => {
  test.setTimeout(120_000);
  const aliceName = await signUp(alice, { board: "aqa", tier: "Higher" });
  const bobContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const bob = await bobContext.newPage();
  const bobName = await signUp(bob, { board: "edexcel", tier: "Foundation" });

  // They become friends by sharing a room
  const created = await alice.request.post("/api/rooms", {
    data: {
      mode: "room",
      board: null,
      tier: "higher",
      topicSlugs: [],
      questionCount: 3,
      secondsPerQuestion: 10,
    },
  });
  const { code } = await created.json();
  expect((await bob.request.post("/api/rooms/join", { data: { code } })).status()).toBe(200);

  const seen: Record<string, string[]> = { alice: [], bob: [] };
  for (const [who, page, right] of [
    ["alice", alice, true],
    ["bob", bob, false],
  ] as const) {
    await page.getByRole("link", { name: "Play today's challenge" }).click();
    await expect(page).toHaveURL(/\/play\/daily$/);
    await page.getByRole("button", { name: "Start today's challenge" }).click();
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByText(`Question ${i} of 5`)).toBeVisible();
      seen[who]!.push((await page.locator("[data-instance-id]").getAttribute("data-instance-id"))!);
      // Alice gets them all right; Bob gets only the first one right
      await answerOnScreen(page, right || i === 1);
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
      await page.getByRole("button", { name: i < 5 ? "Next question" : "See results" }).click();
    }
    await expect(page.getByRole("heading", { name: "Today's results" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }

  // Everyone gets the same questions, whatever their board and tier
  expect(seen.bob).toEqual(seen.alice);

  // Bob's results list both friends, Alice first
  const board = bob.getByRole("table", { name: "Today's daily challenge scores" });
  await expect(board.getByRole("row").nth(1)).toContainText(aliceName);
  await expect(board.getByRole("row").nth(1)).toContainText("5/5");
  await expect(board.getByRole("row").nth(2)).toContainText(bobName);
  await expect(board.getByRole("row").nth(2)).toContainText("1/5");

  // The share card shows right and wrong only
  const card = bob.getByLabel("Your result card");
  await expect(card).toContainText("🟩⬜⬜⬜⬜ 1/5");
  await bobContext.grantPermissions(["clipboard-read", "clipboard-write"]);
  await bob.getByRole("button", { name: "Copy result" }).click();
  await expect(bob.getByText("Copied. Paste it to your friends!")).toBeVisible();
  expect(await bob.evaluate(() => navigator.clipboard.readText())).toBe(await card.innerText());

  // You only get one go: coming back shows the results again
  await bob.reload();
  await expect(bob.getByRole("heading", { name: "Today's results" })).toBeVisible();

  // The hub shows the streak and that today is done
  await alice.goto("/play");
  await expect(alice.getByLabel("Daily streak: 1 day")).toBeVisible();
  await expect(alice.getByRole("link", { name: "See today's results" })).toBeVisible();

  // And so does the leaderboard's Today tab
  await alice.goto("/leaderboard?scope=daily");
  await expect(alice.getByRole("heading", { name: "Today's daily challenge" })).toBeVisible();
  await expect(alice.getByRole("cell", { name: bobName })).toBeVisible();
  await bobContext.close();
});

test("daily API: one attempt per day, a streak, and a protected cron", async ({
  page,
  request,
}) => {
  await signUp(page);
  const first = await page.request.post("/api/daily/start");
  expect(first.status()).toBe(201);
  const second = await page.request.post("/api/daily/start");
  expect((await second.json()).sessionId).toBe((await first.json()).sessionId);

  const overview = await (await page.request.get("/api/daily")).json();
  expect(overview).toMatchObject({ questionCount: 5, streak: 0, board: null });
  expect(overview.attempt).toMatchObject({ finished: false, results: [] });

  // A finished attempt yesterday makes a streak that's alive until today is over
  const admin = adminClient();
  const { data: session } = await admin
    .from("solo_sessions")
    .select("user_id")
    .eq("id", overview.attempt.sessionId)
    .single();
  const yesterday = new Date(`${overview.date}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  await admin.from("solo_sessions").insert({
    user_id: session!.user_id,
    settings: { mode: "daily", date: yesterday.toISOString().slice(0, 10) },
    finished_at: new Date().toISOString(),
  });
  expect((await (await page.request.get("/api/daily")).json()).streak).toBe(1);

  // Signed out: no daily
  expect((await request.get("/api/daily")).status()).toBe(401);
  expect((await request.post("/api/daily/start")).status()).toBe(401);

  // The cron route needs the secret, and creates today's and tomorrow's challenges
  expect((await page.request.get("/api/cron/daily")).status()).toBe(401);
  expect(
    (
      await page.request.get("/api/cron/daily", { headers: { authorization: "Bearer wrong" } })
    ).status(),
  ).toBe(401);
  const secret = process.env.CRON_SECRET;
  expect(secret, "CRON_SECRET must be set for the E2E run").toBeTruthy();
  const cron = await page.request.get("/api/cron/daily", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(cron.status()).toBe(200);
  const { dates } = await cron.json();
  expect(dates[0]).toBe(overview.date);
  const { data: days } = await admin
    .from("daily_challenges")
    .select("challenge_date, instance_ids")
    .in("challenge_date", dates);
  expect(days).toHaveLength(2);
  for (const d of days!) expect(d.instance_ids).toHaveLength(5);
});
