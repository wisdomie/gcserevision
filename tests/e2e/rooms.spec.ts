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
