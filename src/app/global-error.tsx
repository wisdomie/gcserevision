"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring/client";
import "./globals.css";

/** Replaces the root layout when it fails, so it brings its own <html>. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => reportClientError(error), [error]);

  return (
    <html lang="en">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p>Sorry, the game couldn&apos;t load. Please try again.</p>
        <button
          onClick={() => retry()}
          className="bg-accent text-accent-foreground min-h-11 rounded-xl px-6 font-semibold"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
