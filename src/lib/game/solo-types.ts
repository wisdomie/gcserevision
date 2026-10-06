// Response shapes for the solo API, shared by route handlers and the client.
import type { PublicQuestion, Solution } from "@/lib/engine/types";
import type { TopicResult } from "./solo";

export interface SoloCurrentQuestion {
  index: number;
  question: PublicQuestion;
}

export interface SoloSummary {
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  topics: TopicResult[];
}

export interface SoloState {
  sessionId: string;
  /** Subject slug, such as "maths" or "biology". */
  subject: string;
  count: number;
  timed: boolean;
  secondsPerQuestion: number;
  score: number;
  answered: number;
  current: SoloCurrentQuestion | null;
  summary: SoloSummary | null;
}

export interface SoloAnswerResult {
  correct: boolean;
  marksAwarded: number;
  marks: number;
  points: number;
  feedback?: string;
  solution: Solution;
  score: number;
  streak: number;
  next: SoloCurrentQuestion | null;
  summary: SoloSummary | null;
}
