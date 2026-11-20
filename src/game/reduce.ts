import { gridsEqual, cloneGrid } from "../domain/grid";
import { isSolved, placeDigit } from "../domain/rules";
import { awardCompletion, chargeHint, hintCost } from "../domain/scoring";
import { findHint, techniqueLabel } from "../domain/techniques";
import type { Grid, Tier } from "../domain/types";
import { snapshotTier } from "./snapshot";
import type { Action, BoardSlot, FreshTier, GameState, PuzzleView, TierSnapshot, UndoFrame } from "./types";

const UNDO_LIMIT = 200;

export function activeSlot(state: GameState): BoardSlot {
  if (state.mode === "practice" && state.practice) return state.practice;
  return state.campaign;
}

export function createGame(campaign: PuzzleView, campaignIndex = 0): GameState {
  return {
    points: 0,
    puzzleStreak: 0,
    dailyStreak: 0,
    lastCompletionDay: null,
    tier: campaign.tier,
    savedTiers: {},
    campaignIndex,
    mode: "campaign",
    selected: 0,
    coachLine: "",
    campaign: freshSlot(campaign),
    practice: null,
    undo: [],
  };
}

/** A first board for a tier that has no campaign lesson. */
export function createPracticeGame(practice: PuzzleView, campaign: PuzzleView, campaignIndex = 0): GameState {
  return {
    ...createGame(campaign, campaignIndex),
    tier: practice.tier,
    mode: "practice",
    practice: freshSlot(practice),
  };
}

function freshSlot(puzzle: PuzzleView): BoardSlot {
  return { puzzle, grid: cloneGrid(puzzle.givens), won: false };
}

function frameOf(state: GameState, grid: Grid): UndoFrame {
  return {
    grid: cloneGrid(grid),
    coachLine: state.coachLine,
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    won: activeSlot(state).won,
  };
}

function commit(state: GameState, slot: BoardSlot, patch: Partial<GameState> = {}): GameState {
  const undo = patch.undo ?? state.undo;
  if (state.mode === "practice") {
    return { ...state, ...patch, undo, practice: slot };
  }
  return { ...state, ...patch, undo, campaign: slot };
}

function pushUndo(state: GameState, slot: BoardSlot, patch: Partial<GameState>): GameState {
  const undo = [...state.undo, frameOf(state, activeSlot(state).grid)].slice(-UNDO_LIMIT);
  return commit(state, slot, { ...patch, undo });
}

function applyGrid(
  state: GameState,
  slot: BoardSlot,
  today: string,
  coachLine: string,
  pointsAfterMove: number,
): GameState {
  if (!isSolved(slot.grid, slot.puzzle.rules)) {
    return pushUndo(state, { ...slot, won: false }, { points: pointsAfterMove, coachLine });
  }
  const award = awardCompletion(
    {
      points: pointsAfterMove,
      puzzleStreak: state.puzzleStreak,
      dailyStreak: state.dailyStreak,
      lastCompletionDay: state.lastCompletionDay,
    },
    slot.puzzle.size,
    today,
  );
  const solvedLine = coachLine
    ? `${coachLine} Solved. +${award.earned} points.`
    : `Solved. +${award.earned} points.`;
  return pushUndo(state, { ...slot, won: true }, {
    points: award.points,
    puzzleStreak: award.puzzleStreak,
    dailyStreak: award.dailyStreak,
    lastCompletionDay: award.lastCompletionDay,
    coachLine: solvedLine,
  });
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "select":
      return { ...state, selected: action.tool };
    case "tap":
      return tap(state, action.row, action.col, action.today);
    case "undo":
      return undo(state);
    case "reset":
      return reset(state);
    case "hint":
      return hint(state, action.today);
    case "switch-campaign":
      return switchCampaign(state);
    case "switch-practice":
      return switchPractice(state, action.puzzle);
    case "new-practice":
      return {
        ...state,
        mode: "practice",
        practice: freshSlot(action.puzzle),
        undo: [],
        coachLine: "New practice board.",
      };
    case "next-lesson":
      return {
        ...state,
        mode: "campaign",
        campaignIndex: action.campaignIndex,
        campaign: freshSlot(action.puzzle),
        undo: [],
        coachLine: "",
      };
    case "choose-tier":
      return chooseTier(state, action.tier, action.fresh);
    default:
      return state;
  }
}

/**
 * Opens a tier. An existing board for that tier is restored.
 * The tier being left is stored beside it, so the new board cannot replace it.
 * Choosing the tier already on screen leaves that board alone.
 */
function chooseTier(state: GameState, tier: Tier, fresh?: FreshTier): GameState {
  if (state.tier === tier) return state;
  const existing = state.savedTiers[tier];
  if (!existing && !fresh) return state;
  const savedTiers: Partial<Record<Tier, TierSnapshot>> = {
    ...state.savedTiers,
    [state.tier]: snapshotTier(state),
  };
  delete savedTiers[tier];
  if (existing) return resumeTier(existing, state, savedTiers, tier);
  if (!fresh) return state;
  return beginFresh(state, tier, fresh, savedTiers);
}

function resumeTier(
  saved: TierSnapshot,
  state: GameState,
  savedTiers: Partial<Record<Tier, TierSnapshot>>,
  tier: Tier,
): GameState {
  const ledgerMoved =
    saved.points !== state.points ||
    saved.puzzleStreak !== state.puzzleStreak ||
    saved.dailyStreak !== state.dailyStreak ||
    saved.lastCompletionDay !== state.lastCompletionDay;
  return {
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    tier,
    savedTiers,
    campaignIndex: saved.campaignIndex,
    mode: saved.mode,
    selected: saved.selected,
    coachLine: saved.coachLine,
    campaign: saved.campaign,
    practice: saved.practice,
    undo: ledgerMoved ? [] : saved.undo,
  };
}

function beginFresh(
  state: GameState,
  tier: Tier,
  fresh: FreshTier,
  savedTiers: Partial<Record<Tier, TierSnapshot>>,
): GameState {
  const shared = {
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    tier,
    savedTiers,
    selected: state.selected,
    undo: [] as UndoFrame[],
    coachLine: "",
  };
  if (fresh.mode === "campaign") {
    return {
      ...shared,
      mode: "campaign",
      campaignIndex: fresh.campaignIndex,
      campaign: freshSlot(fresh.puzzle),
      practice: null,
    };
  }
  return {
    ...shared,
    mode: "practice",
    campaignIndex: fresh.campaignIndex,
    campaign: freshSlot(fresh.campaign),
    practice: freshSlot(fresh.puzzle),
  };
}

function tap(state: GameState, row: number, col: number, today: string): GameState {
  const slot = activeSlot(state);
  if (slot.won) return state;
  const grid = slot.grid;
  if (row < 0 || col < 0 || row >= grid.length || col >= grid[0].length) return state;
  if (slot.puzzle.givens[row][col] != null) {
    return { ...state, coachLine: "That cell is given." };
  }
  if (state.selected === "erase") {
    if (grid[row][col] == null) return state;
    const next = cloneGrid(grid);
    next[row][col] = null;
    return pushUndo(state, { ...slot, grid: next, won: false }, { coachLine: "" });
  }
  if (grid[row][col] === state.selected) return state;
  const placed = placeDigit(grid, row, col, state.selected, slot.puzzle.rules);
  if (!placed.ok) return { ...state, coachLine: placed.rejection.message };
  return applyGrid(state, { ...slot, grid: placed.grid }, today, "", state.points);
}

function undo(state: GameState): GameState {
  const previous = state.undo[state.undo.length - 1];
  if (!previous) return state;
  const slot = activeSlot(state);
  return commit(
    state,
    { ...slot, grid: cloneGrid(previous.grid), won: previous.won },
    {
      undo: state.undo.slice(0, -1),
      coachLine: previous.coachLine,
      points: previous.points,
      puzzleStreak: previous.puzzleStreak,
      dailyStreak: previous.dailyStreak,
      lastCompletionDay: previous.lastCompletionDay,
    },
  );
}

function reset(state: GameState): GameState {
  const slot = activeSlot(state);
  const started = !gridsEqual(slot.grid, slot.puzzle.givens);
  return commit(state, freshSlot(slot.puzzle), {
    undo: [],
    puzzleStreak: started ? 0 : state.puzzleStreak,
    coachLine: started ? "Puzzle streak reset." : "Back to the givens.",
  });
}

function hint(state: GameState, today: string): GameState {
  const slot = activeSlot(state);
  if (slot.won) return state;
  const force = findHint(slot.grid, slot.puzzle.rules);
  if (!force) return { ...state, coachLine: "No forced cell. That hint was free." };
  const cost = hintCost(slot.puzzle.tier);
  if (state.points < cost) return { ...state, coachLine: `A hint costs ${cost} points.` };
  const placed = placeDigit(slot.grid, force.row, force.col, force.digit, slot.puzzle.rules);
  if (!placed.ok) return { ...state, coachLine: placed.rejection.message };
  const charged = chargeHint(state.points, slot.puzzle.tier);
  const line = `Hint: ${techniqueLabel(force.technique)} places ${force.digit}.`;
  return applyGrid(state, { ...slot, grid: placed.grid }, today, line, charged);
}

function switchCampaign(state: GameState): GameState {
  if (state.mode === "campaign") return state;
  return { ...state, mode: "campaign", undo: [], coachLine: "" };
}

function switchPractice(state: GameState, puzzle: PuzzleView): GameState {
  if (state.mode === "practice") return state;
  const practice = state.practice ?? freshSlot(puzzle);
  return { ...state, mode: "practice", practice, undo: [], coachLine: "" };
}
