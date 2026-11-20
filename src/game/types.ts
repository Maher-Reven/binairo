import type { BoardShape, Digit, Grid, RuleId, Tier } from "../domain/types";

export interface PuzzleView {
  id: string;
  tier: Tier;
  shape: BoardShape;
  size: number;
  rules: RuleId[];
  seed: number;
  teach: string;
  givens: Grid;
}

/** Snapshot taken before a move, so undo can put the economy back. */
export interface UndoFrame {
  grid: Grid;
  coachLine: string;
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  lastCompletionDay: string | null;
  won: boolean;
}

export interface BoardSlot {
  puzzle: PuzzleView;
  grid: Grid;
  won: boolean;
}

export type Mode = "campaign" | "practice";

/** One tier's in-progress play, including the score at the time it was stored. */
export interface TierSnapshot {
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  lastCompletionDay: string | null;
  campaignIndex: number;
  mode: Mode;
  selected: Digit | "erase";
  coachLine: string;
  campaign: BoardSlot;
  practice: BoardSlot | null;
  undo: UndoFrame[];
}

export type FreshTier =
  | { mode: "campaign"; puzzle: PuzzleView; campaignIndex: number }
  | { mode: "practice"; puzzle: PuzzleView; campaign: PuzzleView; campaignIndex: number };

export interface GameState {
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  lastCompletionDay: string | null;
  /** Tier the player chose. Its board is the live campaign and practice slots. */
  tier: Tier;
  /** Boards for the other tiers. The live tier is not stored here. */
  savedTiers: Partial<Record<Tier, TierSnapshot>>;
  campaignIndex: number;
  mode: Mode;
  selected: Digit | "erase";
  coachLine: string;
  campaign: BoardSlot;
  practice: BoardSlot | null;
  /** Valid only for the active mode. Cleared when the mode changes. */
  undo: UndoFrame[];
}

export type Action =
  | { type: "select"; tool: Digit | "erase" }
  | { type: "tap"; row: number; col: number; today: string }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "hint"; today: string }
  | { type: "switch-campaign" }
  | { type: "switch-practice"; puzzle: PuzzleView }
  | { type: "new-practice"; puzzle: PuzzleView }
  | { type: "next-lesson"; puzzle: PuzzleView; campaignIndex: number }
  | { type: "choose-tier"; tier: Tier; fresh?: FreshTier };
