// Response shapes for the live-room API, shared by route handlers and the client.
import type { PublicQuestion, Solution } from "@/lib/engine/types";
import type { Ranked, RoomMode, RoomStatus } from "./room";

export interface RoomPlayer extends Ranked {
  isHost: boolean;
  /** Answered the current question (no hint of whether they were right). */
  answered: boolean;
}

export interface RoomState {
  roomId: string;
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  currentIndex: number;
  questionCount: number;
  secondsPerQuestion: number;
  maxPlayers: number;
  /** Server times in ms since epoch. */
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  revealStartedAt: number | null;
  revealMs: number;
  me: string;
  isHost: boolean;
  /** Ranked by score; scores change only when a question closes. */
  players: RoomPlayer[];
  /** The current question, while it is open and during its reveal. */
  question: PublicQuestion | null;
  /** Whether I have answered the current question. */
  answered: boolean;
  serverNow: number;
}

export interface RevealResult {
  userId: string;
  username: string;
  avatar: string | null;
  answered: boolean;
  correct: boolean;
  marksAwarded: number;
  points: number;
}

export interface RoomReveal {
  index: number;
  solution: Solution;
  /** My own answer, if I gave one. Other players' typed answers are never shared. */
  myAnswer: string | null;
  results: RevealResult[];
}
