// Server clock offset (PLAN.md 4.3). Pure; the browser measures, the server decides.

export interface ClockSample {
  /** Client time when the request was sent (ms). */
  sentAt: number;
  /** Server time in the response (ms). */
  serverNow: number;
  /** Client time when the response arrived (ms). */
  receivedAt: number;
}

/**
 * Offset to add to the client clock to get server time, from the sample with
 * the shortest round trip (the least network noise). Assumes the server read
 * its clock halfway through the round trip.
 */
export function clockOffset(samples: readonly ClockSample[]): number {
  if (samples.length === 0) return 0;
  const best = samples.reduce((a, b) =>
    b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a,
  );
  return Math.round(best.serverNow - (best.sentAt + best.receivedAt) / 2);
}

/** Whole seconds left until `endsAt` (server ms), never negative. */
export function secondsLeft(endsAt: number, clientNow: number, offsetMs: number): number {
  return Math.max(0, Math.ceil((endsAt - (clientNow + offsetMs)) / 1000));
}
