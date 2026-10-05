// Strips personal data from error reports before they leave the app
// (PLAN.md 11 and 13). Players are 14–16, so reports carry no user, no
// cookies, no request bodies (answers) and no email addresses.
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const EMAIL = /[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}/gi;

export const scrubText = (text: string) => text.replace(EMAIL, "[email]");

/** A URL without its query string or fragment, which can carry tokens or codes. */
export function scrubUrl(url: string): string {
  return url.split(/[?#]/)[0]!;
}

function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  // Console output can include anything; leave it out
  if (b.category === "console") return null;
  return {
    ...b,
    ...(b.message ? { message: scrubText(b.message) } : {}),
    data: b.data?.url ? { url: scrubUrl(String(b.data.url)), method: b.data.method } : undefined,
  };
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.user;
  delete event.extra;
  delete event.server_name;
  if (event.request) {
    const userAgent = event.request.headers?.["user-agent"];
    event.request = {
      method: event.request.method,
      ...(event.request.url ? { url: scrubUrl(event.request.url) } : {}),
      ...(userAgent ? { headers: { "user-agent": userAgent } } : {}),
    };
  }
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((b): b is Breadcrumb => b !== null);
  }
  return event;
}

/** Shared Sentry options: no default PII, scrubbed events, light sampling. */
export const SENTRY_OPTIONS = {
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
} as const;
