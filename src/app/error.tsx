"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { reportClientError } from "@/lib/monitoring/client";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => reportClientError(error), [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
      <Card className="flex flex-col gap-3 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted">
          Sorry, that didn&apos;t work. Your progress is saved. Try again, or head back to the hub.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => retry()}>Try again</Button>
          <ButtonLink href="/play" variant="secondary">
            Back to the hub
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
