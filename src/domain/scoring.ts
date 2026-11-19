import type { Tier } from "./types";

/**
 * Hint costs are provisional until they are tuned on a real board.
 * A hint that finds nothing is free, and points never go below 0.
 */
export const HINT_COSTS: Record<Tier, number> = {
  junior: 0,
  medium: 10,
  intermediate: 25,
  advanced: 40,
};

export function hintCost(tier: Tier): number {
  return HINT_COSTS[tier];
}

/**
 * Completion points = size * 10, then multiplied by
 * 1 + 0.1 * min(puzzleStreak, 10), using the streak after it increments.
 * Integer form: size * (10 + min(streak, 10)).
 */
export function completionPoints(size: number, puzzleStreakAfterIncrement: number): number {
  const streak = Math.min(Math.max(puzzleStreakAfterIncrement, 0), 10);
  return size * (10 + streak);
}

export function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isNextLocalDay(previousDay: string, today: string): boolean {
  const [year, month, day] = previousDay.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return localDay(date) === today;
}

export interface StreakState {
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  lastCompletionDay: string | null;
}

export interface CompletionAward extends StreakState {
  earned: number;
}

/**
 * Puzzle streak increments on each completion.
 * Daily streak increments when this is the first completion of a local day
 * and that day is the day after the previous completion day.
 * The same day does not increment. A gap resets the daily streak to 1.
 */
export function awardCompletion(state: StreakState, size: number, today: string): CompletionAward {
  const puzzleStreak = state.puzzleStreak + 1;
  const earned = completionPoints(size, puzzleStreak);
  let dailyStreak: number;
  if (state.lastCompletionDay === today) {
    dailyStreak = state.dailyStreak;
  } else if (state.lastCompletionDay != null && isNextLocalDay(state.lastCompletionDay, today)) {
    dailyStreak = state.dailyStreak + 1;
  } else {
    dailyStreak = 1;
  }
  return {
    points: state.points + earned,
    puzzleStreak,
    dailyStreak,
    lastCompletionDay: today,
    earned,
  };
}

export function chargeHint(points: number, tier: Tier): number {
  return Math.max(0, points - hintCost(tier));
}
