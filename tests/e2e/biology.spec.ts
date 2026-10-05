import { expect, test } from "@playwright/test";
import {
  adminClient,
  answerOnScreen,
  expectNoHorizontalScroll,
  setHiddenAnswer,
  signUp,
} from "./helpers";

// PLAN.md M9: a second subject, with written answers marked on key terms.
test.use({ viewport: { width: 360, height: 740 } });

test("a player practises Biology, answering in words and by choice", async ({ page }) => {
  await signUp(page, { tier: "Foundation" });
  await page.getByRole("link", { name: "Practise Biology" }).click();
  await expect(page).toHaveURL(/\/play\/solo\?subject=biology$/);
  await expect(page.getByRole("link", { name: "Biology" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("group", { name: "Cell biology" })).toBeVisible();
  // Maths topics aren't offered here
  await expect(page.getByRole("checkbox", { name: "Fractions" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  await page.getByRole("checkbox", { name: "Respiration" }).check();
  await page.getByRole("checkbox", { name: "Hormones and blood glucose" }).check();
  await page.getByRole("radio", { name: "5" }).check({ force: true });
  await page.getByRole("button", { name: /^Start \(2 topics\)$/ }).click();
  await expect(page).toHaveURL(/\/play\/solo\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").pop()!;

  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`Question ${i} of 5`)).toBeVisible();
    // Calculators only matter in maths
    await expect(page.getByText(/calculator/i)).toHaveCount(0);
    await answerOnScreen(page, true);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Correct!" })).toBeVisible();
    await page.getByRole("button", { name: i < 5 ? "Next question" : "See results" }).click();
  }
  await expect(page.getByText("5 / 5", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Play again" })).toHaveAttribute(
    "href",
    "/play/solo?subject=biology",
  );

  const { data } = await adminClient()
    .from("solo_session_questions")
    .select("question_instances(generator_key, topics(slug))")
    .eq("session_id", sessionId);
  const rows = (data ?? []).map(
    (r) => r.question_instances as unknown as { generator_key: string; topics: { slug: string } },
  );
  expect(rows).toHaveLength(5);
  for (const r of rows) {
    expect(r.generator_key).toMatch(/^bank:/);
    expect(["respiration", "hormones-blood-glucose"]).toContain(r.topics.slug);
  }
});

test("written answers earn a mark per key point", async ({ page }) => {
  await signUp(page, { tier: "Higher" });
  await page.goto("/play/solo?subject=biology");
  await page.getByRole("checkbox", { name: "Ecosystems and adaptations" }).check();
  await page.getByRole("radio", { name: "5" }).check({ force: true });
  await page.getByRole("button", { name: /^Start \(1 topic\)$/ }).click();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // Make the first question a known two-point written answer
  const instanceId = (await page.locator("[data-instance-id]").getAttribute("data-instance-id"))!;
  await setHiddenAnswer(
    instanceId,
    { kind: "keywords", groups: [["light"], ["water"], ["space"]], need: 2 },
    "Light and water",
  );
  const { error } = await adminClient()
    .from("question_instances")
    .update({ marks: 2 })
    .eq("id", instanceId);
  expect(error).toBeNull();

  // Answered through the API, whatever input the question shows
  const sessionId = page.url().split("/").pop()!;
  const res = await page.request.post("/api/solo/answer", {
    data: { sessionId, instanceId, raw: "They compete for LIGHT." },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({
    correct: false,
    marksAwarded: 1,
    marks: 2,
    feedback: "1 of 2 key points",
  });
});

test("friends can play a Biology room", async ({ page }) => {
  await signUp(page);
  await page.goto("/rooms/new?subject=biology");
  await expect(page.getByRole("link", { name: "Biology" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("checkbox", { name: "Photosynthesis" })).toBeVisible();

  const created = await page.request.post("/api/rooms", {
    data: {
      mode: "room",
      subject: "biology",
      board: null,
      tier: "higher",
      topicSlugs: ["photosynthesis"],
      questionCount: 5,
      secondsPerQuestion: 30,
    },
  });
  expect(created.status()).toBe(201);
  const { code } = await created.json();

  const { data: room } = await adminClient()
    .from("rooms")
    .select("id, subjects(slug)")
    .eq("code", code)
    .single();
  expect((room!.subjects as unknown as { slug: string }).slug).toBe("biology");
  const { data: questions } = await adminClient()
    .from("room_questions")
    .select("question_instances(generator_key, topics(slug))")
    .eq("room_id", room!.id);
  expect(questions).toHaveLength(5);
  for (const q of questions ?? []) {
    const instance = q.question_instances as unknown as {
      generator_key: string;
      topics: { slug: string };
    };
    expect(instance.generator_key).toMatch(/^bank:/);
    expect(instance.topics.slug).toBe("photosynthesis");
  }
});
