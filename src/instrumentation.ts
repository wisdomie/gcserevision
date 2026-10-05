// Error monitoring (PLAN.md 13). Off unless SENTRY_DSN is set.
import type { Instrumentation } from "next";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  const { SENTRY_OPTIONS } = await import("./lib/monitoring/scrub");
  Sentry.init({ dsn: process.env.SENTRY_DSN, ...SENTRY_OPTIONS });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
