// Rate limit rules (PLAN.md 11). Pure: no Supabase imports, so it's unit tested.
// Per-IP limits are generous because a whole school class can share one IP.

export interface LimitRule {
  /** How many requests are allowed in each window. */
  max: number;
  windowSeconds: number;
}

export interface ActionLimits {
  perUser: LimitRule;
  perIp?: LimitRule;
}

export const LIMITS = {
  /** Answer submissions (solo, daily and rooms). */
  answer: { perUser: { max: 30, windowSeconds: 60 }, perIp: { max: 900, windowSeconds: 60 } },
  /** Creating a live room or duel. */
  createRoom: { perUser: { max: 10, windowSeconds: 600 }, perIp: { max: 120, windowSeconds: 600 } },
  /** Trying room codes: stops guessing codes. */
  joinRoom: { perUser: { max: 20, windowSeconds: 600 }, perIp: { max: 300, windowSeconds: 600 } },
  /** Starting a solo session or the daily. */
  startSession: {
    perUser: { max: 30, windowSeconds: 600 },
    perIp: { max: 600, windowSeconds: 600 },
  },
  /** The timer and reveal nudges every player's page sends. */
  roomNudge: { perUser: { max: 120, windowSeconds: 60 } },
} as const satisfies Record<string, ActionLimits>;

export type LimitedAction = keyof typeof LIMITS;

/**
 * The client's IP address from proxy headers. Vercel sets `x-real-ip` and puts
 * the client first in `x-forwarded-for`. Null when neither is present.
 */
export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}

/** A friendly message for a blocked request. */
export function tooManyMessage(retryAfterSeconds: number): string {
  if (retryAfterSeconds <= 60) return "Slow down a little! Try again in a moment.";
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `That's a lot of tries. Have a break and try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
