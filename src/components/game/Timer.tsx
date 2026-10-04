"use client";

import { useEffect, useState } from "react";

/**
 * Counts down from `seconds`. Display only: the server keeps time. Give it a
 * `key` per question so it restarts.
 */
export function Timer({ seconds }: { seconds: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 250);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil(seconds - elapsed));
  return (
    <div
      role="timer"
      aria-label={`${left} seconds left`}
      className="flex items-center gap-2 text-sm"
    >
      <div className="bg-border h-2 w-24 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className="bg-accent h-full transition-[width]"
          style={{ width: `${(left / seconds) * 100}%` }}
        />
      </div>
      <span className="tabular-nums" aria-hidden="true">
        {left > 0 ? `${left}s` : "Time's up"}
      </span>
    </div>
  );
}
