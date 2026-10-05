import { expect, test } from "@playwright/test";
import { adminClient, answerOnScreen, expectNoHorizontalScroll, signUp } from "./helpers";

// PLAN.md M7: diagram questions draw on a phone and are marked like any other.
test.use({ viewport: { width: 360, height: 740 } });

test("a Foundation player answers geometry questions with diagrams", async ({ page }) => {
  await signUp(page, { board: "edexcel", tier: "Foundation" });
  await page.getByRole("link", { name: "Start practising" }).click();
  await page.getByRole("checkbox", { name: "All geometry and measures topics" }).check();
  await page.getByRole("button", { name: /^Start \(\d+ topics?\)$/ }).click();
  await expect(page).toHaveURL(/\/play\/solo\/[0-9a-f-]{36}$/);

  let diagrams = 0;
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Question ${i} of 10`)).toBeVisible();
    // Generated geometry questions have diagrams; hand-written word problems don't
    const instanceId = (await page.locator("[data-instance-id]").getAttribute("data-instance-id"))!;
    const { data } = await adminClient()
      .from("question_instances")
      .select("generator_key")
      .eq("id", instanceId)
      .single();
    const diagram = page.getByTestId("question-diagram");
    if (data!.generator_key!.startsWith("bank:")) {
      await expect(diagram).toHaveCount(0);
    } else {
      diagrams++;
      await expect(diagram).toBeVisible();
      // Screen readers get a description instead of the picture
      await expect(diagram).toHaveAttribute("role", "img");
      expect((await diagram.getAttribute("aria-label"))!.length).toBeGreaterThan(20);
      // It fits on the phone screen
      const box = (await diagram.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(360);
      expect(box.height).toBeGreaterThan(80);
    }
    await expectNoHorizontalScroll(page);

    await answerOnScreen(page, true);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Correct!" })).toBeVisible();
    await page.getByRole("button", { name: i < 10 ? "Next question" : "See results" }).click();
  }
  await expect(page.getByText("10 / 10", { exact: true }).first()).toBeVisible();
  expect(diagrams).toBeGreaterThan(0);
});

test("live room players see the same chart", async ({ page: host, browser }) => {
  await signUp(host);
  const created = await host.request.post("/api/rooms", {
    data: {
      mode: "room",
      board: null,
      tier: "higher",
      // Topics without hand-written questions, so every question has a diagram
      topicSlugs: ["scatter-graphs", "straight-line-graphs"],
      questionCount: 3,
      secondsPerQuestion: 30,
    },
  });
  expect(created.status()).toBe(201);
  const { code } = await created.json();
  const guestContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const guest = await guestContext.newPage();
  await signUp(guest);
  expect((await guest.request.post("/api/rooms/join", { data: { code } })).status()).toBe(200);
  expect((await host.request.post(`/api/rooms/${code}/start`)).status()).toBe(200);

  const labels: string[] = [];
  for (const page of [host, guest]) {
    await page.goto(`/rooms/${code}`);
    await expect(page.getByText("Question 1 of 3")).toBeVisible();
    const diagram = page.getByTestId("question-diagram");
    await expect(diagram).toBeVisible();
    labels.push((await diagram.getAttribute("aria-label"))!);
    await expectNoHorizontalScroll(page);
  }
  expect(labels[1]).toBe(labels[0]);
  await guestContext.close();
});
