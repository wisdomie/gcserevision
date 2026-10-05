"use client";

import { Button } from "@/components/ui/Button";
import { safeRedirectPath } from "@/lib/api/redirect";

/** Goes back to the page that couldn't load (only ever a path on this site). */
export function RetryButton() {
  return (
    <Button
      onClick={() => {
        const from = new URLSearchParams(window.location.search).get("from");
        window.location.assign(safeRedirectPath(from));
      }}
    >
      Try again
    </Button>
  );
}
