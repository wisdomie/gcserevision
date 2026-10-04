// Username rules and a starter profanity filter (PLAN.md 11).
// The block list is deliberately short; extend it as needed.

export const USERNAME_RULES = "3–20 letters, numbers or underscores";

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
};

/** Blocked anywhere in the name (long enough not to cause false positives). */
const BLOCKED_SUBSTRINGS = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "bastard",
  "wank",
  "twat",
  "slut",
  "whore",
  "nigg",
  "fagg",
  "retard",
  "spastic",
  "rape",
  "nazi",
  "hitler",
  "penis",
  "vagina",
  "pussy",
  "dick",
  "cock",
  "bollock",
  "bellend",
  "arsehole",
  "asshole",
  "porn",
  "boob",
  "jizz",
  "horny",
  "tranny",
  "paedo",
  "pedo",
  "kill",
  "suicide",
];

/** Blocked only as a whole word between underscores/numbers (short words). */
const BLOCKED_WORDS = [
  "ass",
  "arse",
  "tit",
  "tits",
  "fag",
  "sex",
  "cum",
  "kys",
  "paki",
  "chink",
  "coon",
  "wog",
  "dyke",
  "spaz",
  "prick",
  "piss",
  "crap",
  "nude",
  "nob",
  "knob",
  "hoe",
];

function deLeet(s: string): string {
  return [...s.toLowerCase()].map((c) => LEET[c] ?? c).join("");
}

export type UsernameCheck = { ok: true } | { ok: false; reason: string };

export function checkUsername(username: string): UsernameCheck {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return { ok: false, reason: `Usernames must be ${USERNAME_RULES}.` };
  }
  const lower = username.toLowerCase();
  const letters = deLeet(lower).replace(/[^a-z]/g, "");
  const words = lower.split(/[_\d]+/).filter(Boolean);
  const leetWords = deLeet(lower).split(/_+/).filter(Boolean);

  const blocked =
    BLOCKED_SUBSTRINGS.some((b) => letters.includes(b)) ||
    [...words, ...leetWords].some((w) => BLOCKED_WORDS.includes(w));
  return blocked ? { ok: false, reason: "Please choose a different username." } : { ok: true };
}
