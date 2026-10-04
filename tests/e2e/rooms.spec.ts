import { expect, test, type Page } from "@playwright/test";
import { answerOnScreen, expectNoHorizontalScroll, signUp } from "./helpers";

// PLAN.md 12.4: a two-browser live room. Create, join, play, see the winner.
test.use({ viewport: { width: 360, height: 740 } });
test.describe.configure({ timeout: 180_000 });

async function joinFromHub(page: Page, code: string) {
  await page.getByLabel("Room code").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${code}$`));
}

test("two friends play a live room and see the winner", async ({ page: host, browser }) => {
  const hostName = await signUp(host, { board: "aqa", tier: "Higher" });
  await host.getByRole("link", { name: "Create a room" }).click();
  await host.getByText("5", { exact: true }).click();
  await host.getByText("20s", { exact: true }).click();
  await host.getByRole("button", { name: "Create room" }).click();
  await expect(host).toHaveURL(/\/rooms\/[A-Z2-9]{6}$/);
  const code = (await host.getByTestId("room-code").textContent())!.trim();
  await expectNoHorizontalScroll(host);

  const guestContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const guest = await guestContext.newPage();
  const guestName = await signUp(guest, { board: "edexcel", tier: "Higher" });
  await joinFromHub(guest, code);

  // Both lobbies show both players; only the host can start
  for (const page of [host, guest]) {
    const players = page.getByRole("listitem");
    await expect(players.filter({ hasText: hostName })).toBeVisible();
    await expect(players.filter({ hasText: guestName })).toBeVisible();
  }
  await expect(guest.getByText("Waiting for the host to start the game…")).toBeVisible();
  await host.getByRole("button", { name: "Start the game" }).click();

  for (let i = 1; i <= 5; i++) {
    for (const page of [host, guest]) {
      await expect(page.getByText(`Question ${i} of 5`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("timer")).toBeVisible();
    }
    await expectNoHorizontalScroll(guest);
    // The host gets everything right, the guest everything wrong
    await answerOnScreen(host, true);
    await host.getByRole("button", { name: "Lock in answer" }).click();
    await expect(host.getByText("Answer locked in.")).toBeVisible();
    // The guest sees the host locked in, without seeing whether they were right
    await expect(guest.getByText("Locked in: 1 of 2")).toBeVisible();
    await answerOnScreen(guest, false);
    await guest.getByRole("button", { name: "Lock in answer" }).click();

    // Everyone answered, so the question closes straight away
    await expect(host.getByRole("heading", { name: /Correct! \+\d+ points/ })).toBeVisible();
    await expect(guest.getByRole("heading", { name: "Not quite" })).toBeVisible();
    await expect(guest.getByText("Answer:")).toBeVisible();
    await expect(guest.getByRole("table", { name: "Scoreboard" })).toBeVisible();
    await expectNoHorizontalScroll(guest);
  }

  await expect(host.getByRole("heading", { name: "You win! 🎉" })).toBeVisible({ timeout: 15_000 });
  await expect(guest.getByRole("heading", { name: `${hostName} wins!` })).toBeVisible();
  await expect(guest.getByRole("list", { name: "Podium" })).toContainText(hostName);
  await expectNoHorizontalScroll(guest);

  // They now count as friends on the leaderboard
  await guest.goto("/leaderboard");
  await expect(guest.getByText(hostName).first()).toBeVisible();
  await guestContext.close();
});

test("the game keeps going when the host closes their tab", async ({ page: host, browser }) => {
  await signUp(host);
  const created = await host.request.post("/api/rooms", {
    data: {
      mode: "room",
      board: null,
      tier: "higher",
      topicSlugs: [],
      questionCount: 3,
      secondsPerQuestion: 10,
    },
  });
  expect(created.status()).toBe(201);
  const { code } = await created.json();

  const guestContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const guest = await guestContext.newPage();
  await signUp(guest);
  await joinFromHub(guest, code);
  expect((await host.request.post(`/api/rooms/${code}/start`)).status()).toBe(200);
  await host.close();

  // Nobody else moves the game on: the guest's own page closes each question on time
  for (let i = 1; i <= 3; i++) {
    await expect(guest.getByText(`Question ${i} of 3`)).toBeVisible({ timeout: 20_000 });
    await answerOnScreen(guest, true);
    await guest.getByRole("button", { name: "Lock in answer" }).click();
    await expect(guest.getByRole("heading", { name: /Correct!/ })).toBeVisible({
      timeout: 20_000,
    });
  }
  await expect(guest.getByRole("heading", { name: "You win! 🎉" })).toBeVisible({
    timeout: 20_000,
  });
  await guestContext.close();
});

// PLAN.md M5 "done when": 4 phones play a 10-question room with no desyncs, and a host who
// closes their tab mid-game doesn't stall it.
test("four players stay in sync over 10 questions when the host leaves", async ({
  page: host,
  browser,
}) => {
  test.setTimeout(420_000);
  await signUp(host);
  const created = await host.request.post("/api/rooms", {
    data: {
      mode: "room",
      board: null,
      tier: "higher",
      topicSlugs: [],
      questionCount: 10,
      secondsPerQuestion: 10,
    },
  });
  expect(created.status()).toBe(201);
  const { code } = await created.json();

  const guests: Page[] = [];
  for (let g = 0; g < 3; g++) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    await signUp(page);
    await joinFromHub(page, code);
    guests.push(page);
  }
  await host.goto(`/rooms/${code}`);
  await host.getByRole("button", { name: "Start the game" }).click();

  for (let i = 1; i <= 10; i++) {
    const players = i < 4 ? [host, ...guests] : guests;
    if (i === 4) await host.close();

    // Everyone still here sees the same question
    const ids = new Set<string>();
    for (const page of players) {
      await expect(page.getByText(`Question ${i} of 10`)).toBeVisible({ timeout: 25_000 });
      ids.add((await page.locator("[data-instance-id]").getAttribute("data-instance-id"))!);
    }
    expect(ids.size).toBe(1);

    // Guest 1 always right, guest 2 right on even questions, guest 3 always wrong
    const plays: [Page, boolean][] = [
      ...(i < 4 ? [[host, true] as [Page, boolean]] : []),
      [guests[0]!, true],
      [guests[1]!, i % 2 === 0],
      [guests[2]!, false],
    ];
    for (const [page, right] of plays) {
      await answerOnScreen(page, right);
      await page.getByRole("button", { name: "Lock in answer" }).click();
    }
    for (const page of players)
      await expect(page.getByRole("table", { name: "Scoreboard" })).toBeVisible({
        timeout: 25_000,
      });
  }

  // Identical final standings on every remaining phone
  const standings: string[] = [];
  for (const page of guests) {
    await expect(page.getByRole("heading", { name: "Final scores" })).toBeVisible({
      timeout: 25_000,
    });
    const text = await page.getByRole("table", { name: "Scoreboard" }).innerText();
    standings.push(text.replace(/\s*\(you\)/g, ""));
  }
  expect(new Set(standings).size).toBe(1);
  await expect(guests[0]!.getByRole("heading", { name: "You win! 🎉" })).toBeVisible();
  for (const page of guests) await page.context().close();
});
