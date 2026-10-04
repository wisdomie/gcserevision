"use client";

import { useEffect, useState } from "react";
import { secondsLeft } from "@/lib/game/clock";

/**
 * Counts down from `seconds`. Display only: the server keeps time. Give it a
 * `key` per question so it restarts. In live rooms pass the server deadline
 * (`endsAt`) and the measured clock offset so every phone shows the same time.
 */
export function Timer({
  seconds,
  endsAt,
  offsetMs = 0,
}: {
  seconds: number;
  endsAt?: number;
  offsetMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [start] = useState(now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const left =
    endsAt !== undefined
      ? Math.min(seconds, secondsLeft(endsAt, now, offsetMs))
      : Math.max(0, Math.ceil(seconds - (now - start) / 1000));
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
