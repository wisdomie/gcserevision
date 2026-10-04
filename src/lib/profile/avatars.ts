// Preset avatars (PLAN.md 11: emoji or presets only, no uploads).
export const AVATARS = [
  "🦊",
  "🐼",
  "🐯",
  "🐸",
  "🐙",
  "🦉",
  "🐧",
  "🦄",
  "🐝",
  "🐢",
  "🐬",
  "🦖",
  "🚀",
  "⚡",
  "🌟",
  "🎯",
] as const;
export type Avatar = (typeof AVATARS)[number];

export const isAvatar = (x: unknown): x is Avatar =>
  typeof x === "string" && (AVATARS as readonly string[]).includes(x);
