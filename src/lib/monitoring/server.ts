import "server-only";

/** Reports an unexpected server error, when monitoring is configured. */
export async function reportServerError(error: unknown): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(error);
}
