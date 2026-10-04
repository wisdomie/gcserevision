import { describe, expect, it } from "vitest";
import {
  canAdvance,
  canGoNext,
  generateRoomCode,
  normaliseRoomCode,
  rankPlayers,
  REVEAL_MS,
  ROOM_CODE_ALPHABET,
  RoomSettingsSchema,
  type RoomTiming,
} from "@/lib/game/room";

describe("room codes", () => {
  it("uses 6 characters from an alphabet with no O, 0, I, 1 or L", () => {
    for (const c of "O0I1L") expect(ROOM_CODE_ALPHABET).not.toContain(c);
    for (let i = 0; i < 200; i++)
      expect(generateRoomCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  });
  it("covers the alphabet's ends", () => {
    expect(generateRoomCode(() => 0)).toBe("AAAAAA");
    expect(generateRoomCode(() => 0.9999999)).toBe("999999");
  });
  it("normalises typed codes", () => {
    expect(normaliseRoomCode("abc-def")).toBe("ABCDEF");
    expect(normaliseRoomCode(" k7m 2pq ")).toBe("K7M2PQ");
    expect(normaliseRoomCode("ABCDE")).toBeNull();
    expect(normaliseRoomCode("ABCDE0")).toBeNull(); // 0 is not in the alphabet
    expect(normaliseRoomCode("ABCDEFG")).toBeNull();
  });
});

describe("state machine guards", () => {
  const question: RoomTiming = {
    status: "question",
    currentIndex: 2,
    questionEndsAt: 10_000,
    revealStartedAt: null,
  };

  it("advances when time is up or everyone has answered", () => {
    expect(canAdvance(question, 2, 9_999, 1, 3)).toBe(false);
    expect(canAdvance(question, 2, 10_000, 0, 3)).toBe(true);
    expect(canAdvance(question, 2, 5_000, 3, 3)).toBe(true);
  });
  it("never advances the wrong question or state", () => {
    expect(canAdvance(question, 1, 20_000, 3, 3)).toBe(false);
    expect(canAdvance({ ...question, status: "reveal" }, 2, 20_000, 3, 3)).toBe(false);
    expect(canAdvance({ ...question, questionEndsAt: null }, 2, 20_000, 0, 3)).toBe(false);
    expect(canAdvance(question, 2, 5_000, 0, 0)).toBe(false);
  });
  it("moves on from a reveal after the reveal time", () => {
    const reveal: RoomTiming = {
      status: "reveal",
      currentIndex: 2,
      questionEndsAt: 10_000,
      revealStartedAt: 11_000,
    };
    expect(canGoNext(reveal, 2, 11_000 + REVEAL_MS - 1)).toBe(false);
    expect(canGoNext(reveal, 2, 11_000 + REVEAL_MS)).toBe(true);
    expect(canGoNext(reveal, 1, 99_999)).toBe(false);
    expect(canGoNext({ ...reveal, revealStartedAt: null }, 2, 99_999)).toBe(false);
    expect(canGoNext(question, 2, 99_999)).toBe(false);
  });
});

describe("rankPlayers", () => {
  const p = (username: string, score: number, correctTimeMs = 0) => ({
    userId: username,
    username,
    avatar: null,
    score,
    correctTimeMs,
  });
  it("ranks by score, breaks ties on time, and shares exact ties", () => {
    const ranked = rankPlayers([
      p("cat", 900, 5000),
      p("ann", 1200),
      p("bob", 900, 4000),
      p("dan", 900, 5000),
    ]);
    expect(ranked.map((r) => [r.username, r.rank])).toEqual([
      ["ann", 1],
      ["bob", 2],
      ["cat", 3],
      ["dan", 3],
    ]);
  });
  it("handles an empty room", () => expect(rankPlayers([])).toEqual([]));
});

describe("room settings", () => {
  const ok = {
    mode: "room",
    board: null,
    tier: "higher",
    topicSlugs: [],
    questionCount: 10,
    secondsPerQuestion: 30,
  };
  it("accepts sensible settings and mixed boards", () => {
    expect(RoomSettingsSchema.safeParse(ok).success).toBe(true);
    expect(RoomSettingsSchema.safeParse({ ...ok, board: "aqa", mode: "duel" }).success).toBe(true);
  });
  it.each([
    { questionCount: 2 },
    { questionCount: 21 },
    { secondsPerQuestion: 5 },
    { secondsPerQuestion: 120 },
    { board: "cie" },
    { mode: "battle" },
  ])("rejects %j", (bad) =>
    expect(RoomSettingsSchema.safeParse({ ...ok, ...bad }).success).toBe(false),
  );
});
