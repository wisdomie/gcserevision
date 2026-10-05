"use client";

import { setSoundEnabled, useSoundEnabled } from "@/lib/sound";

export function SoundToggle() {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      aria-label="Sound effects"
      title={on ? "Sound effects on" : "Sound effects off"}
      className="hover:bg-border/40 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg"
    >
      <span aria-hidden="true">{on ? "🔊" : "🔇"}</span>
    </button>
  );
}
