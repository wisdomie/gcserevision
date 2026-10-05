"use client";
// Short sound effects made with the Web Audio API, so there are no audio files
// to download (PLAN.md M8). Players can mute them; the choice is remembered
// on this device.
import { useSyncExternalStore } from "react";

export type SoundKind = "correct" | "partial" | "wrong" | "finish" | "win";

const STORAGE_KEY = "ppg:sound";
const VOLUME = 0.07;

/** Notes as [frequency in Hz, start offset in s, length in s]. */
const TUNES: Record<SoundKind, [number, number, number][]> = {
  correct: [
    [660, 0, 0.12],
    [880, 0.1, 0.18],
  ],
  partial: [
    [587, 0, 0.12],
    [659, 0.1, 0.16],
  ],
  wrong: [
    [330, 0, 0.14],
    [247, 0.12, 0.22],
  ],
  finish: [
    [523, 0, 0.12],
    [659, 0.11, 0.12],
    [784, 0.22, 0.24],
  ],
  win: [
    [523, 0, 0.1],
    [659, 0.09, 0.1],
    [784, 0.18, 0.1],
    [1047, 0.27, 0.32],
  ],
};

const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private browsing: the choice lasts until the page closes
  }
  for (const l of listeners) l();
}

/** Whether sounds are on. Off while rendering on the server. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readEnabled,
    () => false,
  );
}

let context: AudioContext | null = null;

export function playSound(kind: SoundKind): void {
  if (typeof window === "undefined" || !readEnabled()) return;
  try {
    context ??= new AudioContext();
    const ctx = context;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const [freq, at, length] of TUNES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      // A quick fade in and out, so notes don't click
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(VOLUME, now + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + length + 0.02);
    }
  } catch {
    // No audio on this device: play silently
  }
}
