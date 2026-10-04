/**
 * Calls `attempt` until it returns a value. Generators use this to reject
 * draws that don't give "nice" numbers. Deterministic for a seeded Rng.
 */
export function retry<T>(attempt: () => T | null, maxAttempts = 1000): T {
  for (let i = 0; i < maxAttempts; i++) {
    const result = attempt();
    if (result !== null) return result;
  }
  throw new Error(`retry: no valid draw after ${maxAttempts} attempts`);
}
