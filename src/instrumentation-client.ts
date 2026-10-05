// Browser error monitoring. Off unless NEXT_PUBLIC_SENTRY_DSN is set; the SDK
// is loaded separately so it isn't in the main bundle.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("./lib/monitoring/scrub")]).then(
    ([Sentry, { SENTRY_OPTIONS }]) => {
      Sentry.init({ dsn, ...SENTRY_OPTIONS });
    },
  );
}
