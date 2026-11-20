import { cloneGrid } from "../domain/grid";
import { cloneStars } from "../domain/stars";
import type { BoardSlot, GameState, TierSnapshot, UndoFrame } from "./types";

export function snapshotTier(state: GameState): TierSnapshot {
  return {
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    campaignIndex: state.campaignIndex,
    mode: state.mode,
    selected: state.selected,
    coachLine: state.coachLine,
    campaign: cloneSlot(state.campaign),
    practice: state.practice ? cloneSlot(state.practice) : null,
    undo: state.undo.map(cloneFrame),
  };
}

function cloneSlot(slot: BoardSlot): BoardSlot {
  return {
    puzzle: slot.puzzle,
    grid: cloneGrid(slot.grid),
    won: slot.won,
    clean: slot.clean,
    moves: slot.moves,
    hintsUsed: slot.hintsUsed,
  };
}

function cloneFrame(frame: UndoFrame): UndoFrame {
  return { ...frame, grid: cloneGrid(frame.grid), stars: frame.stars ? cloneStars(frame.stars) : null };
}
