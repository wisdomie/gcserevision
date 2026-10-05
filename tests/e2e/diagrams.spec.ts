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
  // These topics also have hand-written questions without charts, so make
  // rooms until one has a chart question, then move it to the front
  // (at most 8 tries: players can create 10 rooms in 10 minutes)
  let code = "";
  for (let attempt = 0; attempt < 8 && !code; attempt++) {
    const created = await host.request.post("/api/rooms", {
      data: {
        mode: "room",
        board: null,
        tier: "higher",
        topicSlugs: ["scatter-graphs", "straight-line-graphs"],
        questionCount: 3,
        secondsPerQuestion: 30,
      },
    });
    expect(created.status()).toBe(201);
    const candidate = (await created.json()).code as string;
    const { data } = await adminClient()
      .from("rooms")
      .select("id, room_questions(idx, instance_id, question_instances(public_payload))")
      .eq("code", candidate)
      .single();
    const questions = data!.room_questions as unknown as {
      idx: number;
      instance_id: string;
      question_instances: { public_payload: { diagram?: unknown } };
    }[];
    const chart = questions.find((q) => q.question_instances.public_payload.diagram);
    if (!chart) continue;
    if (chart.idx !== 0) {
      const first = questions.find((q) => q.idx === 0)!;
      const swap = (instanceId: string, idx: number) =>
        adminClient()
          .from("room_questions")
          .update({ idx })
          .eq("room_id", data!.id)
          .eq("instance_id", instanceId);
      expect((await swap(first.instance_id, 99)).error).toBeNull();
      expect((await swap(chart.instance_id, 0)).error).toBeNull();
      expect((await swap(first.instance_id, chart.idx)).error).toBeNull();
    }
    code = candidate;
  }
  expect(code, "no room started with a chart").not.toBe("");
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
