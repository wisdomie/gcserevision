import type { Metadata } from "next";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = { title: "You're offline · Past Paper Game" };

/** Shown by the service worker (public/sw.js) when a page can't load without a connection. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p aria-hidden="true" className="text-5xl">
        📡
      </p>
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-muted">
        The game needs an internet connection to fetch questions and mark your answers. Check your
        Wi-Fi or data, then try again.
      </p>
      <RetryButton />
    </main>
  );
}
