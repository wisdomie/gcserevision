import { timingSafeEqual } from "node:crypto";
import { errorResponse } from "@/lib/api/handler";
import { dailyDate } from "@/lib/game/daily";
import { ensureDailyChallenge } from "@/lib/game/daily-server";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. No secret, no access. */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Scheduled daily (vercel.json): makes sure today's and tomorrow's challenges
 * exist, so nobody waits for one to be generated at midnight. The daily page
 * also creates today's if this hasn't run.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const now = Date.now();
    const dates = [dailyDate(new Date(now)), dailyDate(new Date(now + DAY_MS))];
    for (const date of dates) await ensureDailyChallenge(date);
    return Response.json({ ok: true, dates });
  } catch (error) {
    return errorResponse(error);
  }
}
