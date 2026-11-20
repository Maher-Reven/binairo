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

export interface GameState {
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
  | { type: "start-tier"; mode: "campaign"; puzzle: PuzzleView; campaignIndex: number }
  | { type: "start-tier"; mode: "practice"; puzzle: PuzzleView };
