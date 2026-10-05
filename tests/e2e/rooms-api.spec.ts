import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { rawAnswerFor, signUp } from "./helpers";

// Server-side guarantees for live rooms (PLAN.md 4, 10 and 12.3).
test.describe.configure({ timeout: 120_000 });

const settings = (mode: "room" | "duel" = "room") => ({
  mode,
  board: null,
  tier: "higher",
  topicSlugs: ["fractions", "hcf"],
  questionCount: 3,
  secondsPerQuestion: 10,
});

async function createRoom(request: APIRequestContext, mode: "room" | "duel" = "room") {
  const res = await request.post("/api/rooms", { data: settings(mode) });
  expect(res.status()).toBe(201);
  return (await res.json()).code as string;
}

test("rooms API: membership, host-only start, one answer each, deadlines and idempotent closing", async ({
  page: host,
  browser,
}) => {
  await signUp(host);
  const guest = await browser.newPage();
  await signUp(guest);
  const outsider = await browser.newPage();
  await signUp(outsider);

  const code = await createRoom(host.request);
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);

  // Unknown codes and non-members
  expect((await guest.request.post("/api/rooms/join", { data: { code: "ZZZZZZ" } })).status()).toBe(
    404,
  );
  expect((await outsider.request.get(`/api/rooms/${code}`)).status()).toBe(403);

  // Join (codes are forgiving about case and dashes); joining twice is harmless
  for (const typed of [code.toLowerCase(), `${code.slice(0, 3)}-${code.slice(3)}`]) {
    expect((await guest.request.post("/api/rooms/join", { data: { code: typed } })).status()).toBe(
      200,
    );
  }

  // Only the host can start, and only once
  expect((await guest.request.post(`/api/rooms/${code}/start`)).status()).toBe(403);
  expect(await (await host.request.post(`/api/rooms/${code}/start`)).json()).toEqual({
    started: true,
  });
  expect(await (await host.request.post(`/api/rooms/${code}/start`)).json()).toEqual({
    started: false,
  });
  // A started room can't be joined
  expect((await outsider.request.post("/api/rooms/join", { data: { code } })).status()).toBe(409);

  const state = await (await guest.request.get(`/api/rooms/${code}`)).json();
  expect(state.status).toBe("question");
  expect(state.currentIndex).toBe(0);
  const question = state.question;
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
  // No reveal while the question is open
  expect((await guest.request.get(`/api/rooms/${code}/reveal?idx=0`)).status()).toBe(409);

  // One answer each; the reply says nothing about correctness
  // Typed answers get extra spaces (still marked right) so a leak of the text is easy to spot
  const raw = await rawAnswerFor(question.instanceId, true);
  const answer = {
    instanceId: question.instanceId,
    raw: question.inputType === "mcq" ? raw : `  ${raw}  `,
  };
  const first = await guest.request.post(`/api/rooms/${code}/answer`, { data: answer });
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual({ accepted: true });
  expect((await guest.request.post(`/api/rooms/${code}/answer`, { data: answer })).status()).toBe(
    409,
  );
  expect(
    (
      await guest.request.post(`/api/rooms/${code}/answer`, {
        data: { ...answer, raw: "1".repeat(201) },
      })
    ).status(),
  ).toBe(400);
  // Scores don't move until the question closes
  const mid = await (await host.request.get(`/api/rooms/${code}`)).json();
  expect(mid.players.every((p: { score: number }) => p.score === 0)).toBe(true);
  expect(mid.players.find((p: { userId: string }) => p.userId !== mid.me).answered).toBe(true);

  // Not everyone has answered and time isn't up: closing early does nothing
  expect(
    await (
      await guest.request.post(`/api/rooms/${code}/advance`, { data: { fromIndex: 0 } })
    ).json(),
  ).toEqual({ advanced: false });

  // After the deadline (plus the grace period) a late answer is refused
  await host.waitForTimeout(11_000);
  expect((await host.request.post(`/api/rooms/${code}/answer`, { data: answer })).status()).toBe(
    409,
  );

  // Two players close the question at once: exactly one does it
  const closes = await Promise.all(
    [host, guest].map(async (p) =>
      (await p.request.post(`/api/rooms/${code}/advance`, { data: { fromIndex: 0 } })).json(),
    ),
  );
  expect(closes.filter((c) => c.advanced)).toHaveLength(1);

  // Now the reveal is available: the solution and everyone's points, but not others' typed answers
  const reveal = await (await host.request.get(`/api/rooms/${code}/reveal?idx=0`)).json();
  expect(reveal.solution.final).toBeTruthy();
  expect(reveal.myAnswer).toBeNull();
  const guestResult = reveal.results.find((r: { answered: boolean }) => r.answered);
  expect(guestResult).toMatchObject({ correct: true });
  expect(guestResult.points).toBeGreaterThan(0);
  for (const r of reveal.results)
    expect(Object.keys(r).sort()).toEqual(
      ["answered", "avatar", "correct", "marksAwarded", "points", "userId", "username"].sort(),
    );
  if (question.inputType !== "mcq") expect(JSON.stringify(reveal)).not.toContain(answer.raw);
  const after = await (await host.request.get(`/api/rooms/${code}`)).json();
  expect(after.status).toBe("reveal");
  expect(after.players[0].score).toBe(guestResult.points);
  // Moving on waits for the reveal to show
  expect(
    await (await host.request.post(`/api/rooms/${code}/next`, { data: { fromIndex: 0 } })).json(),
  ).toEqual({ moved: false });

  // Room tables are readable by members only, and answers by nobody
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  await supabase.auth.signInAnonymously();
  const { data: rooms } = await supabase.from("rooms").select("id").eq("id", after.roomId);
  expect(rooms).toEqual([]);
  for (const table of ["answers", "room_questions", "question_secrets"] as const) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    expect(error, `${table} should be blocked`).not.toBeNull();
    expect(data).toBeNull();
  }

  await guest.close();
  await outsider.close();
});

test("a duel starts by itself when the second player joins, and a leaving host hands over", async ({
  page: host,
  browser,
}) => {
  await signUp(host);
  const guest = await browser.newPage();
  await signUp(guest);
  const third = await browser.newPage();
  await signUp(third);

  const duel = await createRoom(host.request, "duel");
  expect((await host.request.get(`/api/rooms/${duel}`)).status()).toBe(200);
  expect((await guest.request.post("/api/rooms/join", { data: { code: duel } })).status()).toBe(
    200,
  );
  const state = await (await guest.request.get(`/api/rooms/${duel}`)).json();
  expect(state.mode).toBe("duel");
  expect(state.status).toBe("question");
  expect(state.maxPlayers).toBe(2);
  expect((await third.request.post("/api/rooms/join", { data: { code: duel } })).status()).toBe(
    409,
  );

  // A room can't start with only the host in it
  const room = await createRoom(host.request);
  expect((await host.request.post(`/api/rooms/${room}/start`)).status()).toBe(409);
  // The host leaves the lobby: the next player becomes host and can start
  await guest.request.post("/api/rooms/join", { data: { code: room } });
  await third.request.post("/api/rooms/join", { data: { code: room } });
  expect((await host.request.post(`/api/rooms/${room}/leave`)).status()).toBe(200);
  expect((await host.request.get(`/api/rooms/${room}`)).status()).toBe(403);
  const handed = await (await guest.request.get(`/api/rooms/${room}`)).json();
  expect(handed.isHost).toBe(true);
  expect((await guest.request.post(`/api/rooms/${room}/start`)).status()).toBe(200);

  await guest.close();
  await third.close();
});

test("server time endpoint", async ({ request }) => {
  const before = Date.now();
  const { now } = await (await request.get("/api/time")).json();
  expect(Math.abs(now - before)).toBeLessThan(60_000);
});

test("a signed-out room link goes to sign-in and comes back to the room", async ({ request }) => {
  const res = await request.get("/rooms/K7M2PQ", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const location = new URL(res.headers()["location"], "http://x");
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("next")).toBe("/rooms/K7M2PQ");
});
