import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signUp } from "./helpers";

// Server-side guarantees for solo mode (PLAN.md 4 and 12.3).
test("solo API: marks server-side, rejects double answers and hides other players' sessions", async ({
  page,
  browser,
}) => {
  await signUp(page);

  const start = await page.request.post("/api/solo/start", {
    data: { topicSlugs: ["fractions"], count: 5, timed: false },
  });
  expect(start.status()).toBe(201);
  const state = await start.json();
  const question = state.current.question;

  // The public question carries no answer or solution
  expect(Object.keys(question).sort()).toEqual(
    [
      "calculator",
      "inputType",
      "instanceId",
      "marks",
      "promptMd",
      "topicName",
      ...(question.options ? ["options"] : []),
    ].sort(),
  );

  const answer = { sessionId: state.sessionId, instanceId: question.instanceId, raw: "1/2" };
  const first = await page.request.post("/api/solo/answer", { data: answer });
  expect(first.status()).toBe(200);
  const second = await page.request.post("/api/solo/answer", { data: answer });
  expect(second.status()).toBe(409);

  // Oversized and malformed answers are rejected
  const huge = await page.request.post("/api/solo/answer", {
    data: { ...answer, raw: "1".repeat(201) },
  });
  expect(huge.status()).toBe(400);

  // Answers and secrets are not readable with the public key, even when signed in
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  await supabase.auth.signInAnonymously();
  for (const table of [
    "answers",
    "question_secrets",
    "question_instances",
    "solo_session_questions",
  ] as const) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    expect(error, `${table} should be blocked`).not.toBeNull();
    expect(data).toBeNull();
  }

  // Another player cannot see or answer this session
  const other = await browser.newPage();
  await signUp(other);
  expect((await other.request.get(`/api/solo/${state.sessionId}`)).status()).toBe(404);
  const next = (await first.json()).next.question;
  const stolen = await other.request.post("/api/solo/answer", {
    data: { sessionId: state.sessionId, instanceId: next.instanceId, raw: "1" },
  });
  expect(stolen.status()).toBe(404);

  // Signed-out requests are refused
  const anon = await browser.newContext();
  expect(
    (
      await anon.request.post("/api/solo/start", {
        data: { topicSlugs: [], count: 5, timed: false },
      })
    ).status(),
  ).toBe(401);
  await anon.close();
  await other.close();
});
