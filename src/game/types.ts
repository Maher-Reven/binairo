import type { LessonStarsMap } from "../domain/stars";
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
  clean: boolean;
  moves: number;
  hintsUsed: number;
  /** Null on a save from before stars existed. Undo then leaves the star record alone. */
  stars: LessonStarsMap | null;
}

export interface BoardSlot {
  puzzle: PuzzleView;
  grid: Grid;
  won: boolean;
  /** False after a rejected placement on this attempt. Reset starts it clean again. */
  clean: boolean;
  /** Placements and erases. A hint that fills a cell counts. A rejection does not. */
  moves: number;
  hintsUsed: number;
}

export type Mode = "campaign" | "practice";

export type Surface = "tier" | "daily";

/** Undo for the daily board. It does not restore a rejected placement. */
export interface DailyUndo {
  grid: Grid;
  coachLine: string;
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  lastCompletionDay: string | null;
  won: boolean;
  hintsUsed: number;
}

/**
 * The shared daily board. Kept beside the tier boards, never inside them.
 * `clean` stays false after a rejected placement. Hints are counted apart from that.
 */
export interface DailyBoard {
  day: string;
  puzzle: PuzzleView;
  grid: Grid;
  won: boolean;
  elapsedMs: number;
  hintsUsed: number;
  clean: boolean;
  coachLine: string;
  undo: DailyUndo[];
}

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
  /** Valid only for the active tier mode. Cleared when the mode changes. The daily board has its own undo. */
  undo: UndoFrame[];
  /** Which board is on screen. The tier boards stay stored either way. */
  surface: Surface;
  /** Today's shared board, including an unfinished one from earlier today. */
  daily: DailyBoard | null;
  /** Best stars per campaign lesson. A replay can add one and cannot take one away. */
  stars: LessonStarsMap;
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
  | { type: "choose-tier"; tier: Tier; fresh?: FreshTier }
  | { type: "play-daily"; day: string; puzzle?: PuzzleView }
  | { type: "bank-daily"; ms: number };
