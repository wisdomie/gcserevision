// Response shapes for the daily API, shared by route handlers and the client.

export interface DailyBoardRow {
  rank: number;
  username: string;
  avatar: string | null;
  points: number;
  correct: number;
  total: number;
  streak: number;
  isMe: boolean;
}

export interface DailyAttempt {
  sessionId: string;
  finished: boolean;
  score: number;
  /** Per answered question, in order: fully right or not. */
  results: boolean[];
}

export interface DailyOverview {
  /** YYYY-MM-DD, UK time. */
  date: string;
  questionCount: number;
  attempt: DailyAttempt | null;
  /** The player's current daily streak (alive until a whole day is missed). */
  streak: number;
  /** The player and their friends who finished today, once the player has finished. */
  board: DailyBoardRow[] | null;
}
