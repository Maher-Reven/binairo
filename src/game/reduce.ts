import { gridsEqual, cloneGrid } from "../domain/grid";
import { isSolved, placeDigit } from "../domain/rules";
import { awardCompletion, chargeHint, hintCost } from "../domain/scoring";
import { cloneStars, mergeStars, movePar, starsForAttempt } from "../domain/stars";
import { isCampaignLesson } from "../domain/campaign";
import { explainForce, findLook, forceOnLook, lookSentence } from "../domain/techniques";
import type { Force, Grid, Tier } from "../domain/types";
import { snapshotTier } from "./snapshot";
import type {
  Action,
  BoardSlot,
  DailyBoard,
  DailyUndo,
  FreshTier,
  GameState,
  PuzzleView,
  TierSnapshot,
  UndoFrame,
} from "./types";

const UNDO_LIMIT = 200;

export function activeSlot(state: GameState): BoardSlot {
  if (state.surface === "daily" && state.daily) {
    return {
      puzzle: state.daily.puzzle,
      grid: state.daily.grid,
      won: state.daily.won,
      clean: state.daily.clean,
      moves: 0,
      hintsUsed: state.daily.hintsUsed,
    };
  }
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
    surface: "tier",
    daily: null,
    stars: {},
    look: null,
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
  return { puzzle, grid: cloneGrid(puzzle.givens), won: false, clean: true, moves: 0, hintsUsed: 0 };
}

function frameOf(state: GameState, grid: Grid): UndoFrame {
  const slot = activeSlot(state);
  return {
    grid: cloneGrid(grid),
    coachLine: state.coachLine,
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    won: slot.won,
    clean: slot.clean,
    moves: slot.moves,
    hintsUsed: slot.hintsUsed,
    stars: cloneStars(state.stars),
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
  extra: Partial<GameState> = {},
): GameState {
  if (!isSolved(slot.grid, slot.puzzle.rules)) {
    return pushUndo(state, { ...slot, won: false }, { points: pointsAfterMove, coachLine, ...extra });
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
    stars: awardedStars(state, slot),
    ...extra,
  });
}

function awardedStars(state: GameState, slot: BoardSlot): GameState["stars"] {
  if (state.mode !== "campaign" || !isCampaignLesson(slot.puzzle.id)) return state.stars;
  const earned = starsForAttempt({
    clean: slot.clean,
    moves: slot.moves,
    hintsUsed: slot.hintsUsed,
    par: movePar(slot.puzzle.givens),
  });
  return { ...state.stars, [slot.puzzle.id]: mergeStars(state.stars[slot.puzzle.id], earned) };
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
      if (state.surface === "daily") return state;
      return {
        ...state,
        mode: "practice",
        practice: freshSlot(action.puzzle),
        undo: [],
        coachLine: "New practice board.",
        look: null,
      };
    case "next-lesson":
      if (state.surface === "daily") return state;
      return {
        ...state,
        mode: "campaign",
        campaignIndex: action.campaignIndex,
        campaign: freshSlot(action.puzzle),
        undo: [],
        coachLine: "",
        look: null,
      };
    case "choose-tier":
      return chooseTier(state, action.tier, action.fresh);
    case "play-daily":
      return playDaily(state, action.day, action.puzzle);
    case "bank-daily":
      return bankDaily(state, action.ms);
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
  if (state.tier === tier) {
    return state.surface === "tier" ? state : { ...state, surface: "tier", look: null };
  }
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
    surface: "tier",
    daily: state.daily,
    stars: state.stars,
    look: null,
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
    surface: "tier" as const,
    daily: state.daily,
    stars: state.stars,
    look: null,
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
  if (state.surface === "daily" && state.daily) return dailyTap(state, state.daily, row, col, today);
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
    return pushUndo(state, { ...slot, grid: next, won: false, moves: slot.moves + 1 }, { coachLine: "" });
  }
  if (grid[row][col] === state.selected) return state;
  const placed = placeDigit(grid, row, col, state.selected, slot.puzzle.rules);
  if (!placed.ok) return rejectPlacement(state, slot, placed.rejection.message);
  return applyGrid(state, { ...slot, grid: placed.grid, moves: slot.moves + 1 }, today, "", state.points);
}

function rejectPlacement(state: GameState, slot: BoardSlot, message: string): GameState {
  if (!slot.clean) return { ...state, coachLine: message };
  return commit(state, { ...slot, clean: false }, { coachLine: message });
}

function undo(state: GameState): GameState {
  if (state.surface === "daily" && state.daily) return dailyUndo(state, state.daily);
  const previous = state.undo[state.undo.length - 1];
  if (!previous) return state;
  const slot = activeSlot(state);
  return commit(
    state,
    { ...slot, grid: cloneGrid(previous.grid), won: previous.won, clean: previous.clean, moves: previous.moves, hintsUsed: previous.hintsUsed },
    {
      undo: state.undo.slice(0, -1),
      coachLine: previous.coachLine,
      points: previous.points,
      puzzleStreak: previous.puzzleStreak,
      dailyStreak: previous.dailyStreak,
      lastCompletionDay: previous.lastCompletionDay,
      stars: previous.stars ?? state.stars,
    },
  );
}

function reset(state: GameState): GameState {
  if (state.surface === "daily" && state.daily) return dailyReset(state, state.daily);
  const slot = activeSlot(state);
  const started = !gridsEqual(slot.grid, slot.puzzle.givens);
  return commit(state, freshSlot(slot.puzzle), {
    undo: [],
    puzzleStreak: started ? 0 : state.puzzleStreak,
    coachLine: started ? "Puzzle streak reset." : "Back to the givens.",
    look: null,
  });
}

function hint(state: GameState, today: string): GameState {
  if (state.surface === "daily" && state.daily) return dailyHint(state, state.daily, today);
  const slot = activeSlot(state);
  if (slot.won) return state;
  const ready = state.look ? forceOnLook(slot.grid, slot.puzzle.rules, state.look) : null;
  if (state.look && ready) return fillHint(state, slot, ready, today);
  return showLook(state, slot);
}

function showLook(state: GameState, slot: BoardSlot): GameState {
  const look = findLook(slot.grid, slot.puzzle.rules);
  if (!look) return { ...state, look: null, coachLine: "No forced cell. That hint was free." };
  return { ...state, look, coachLine: lookSentence(look) };
}

function fillHint(state: GameState, slot: BoardSlot, force: Force, today: string): GameState {
  const cost = hintCost(slot.puzzle.tier);
  if (state.points < cost) return { ...state, coachLine: `A hint costs ${cost} points.` };
  const placed = placeDigit(slot.grid, force.row, force.col, force.digit, slot.puzzle.rules);
  if (!placed.ok) return { ...state, coachLine: placed.rejection.message };
  const charged = chargeHint(state.points, slot.puzzle.tier);
  const line = explainForce(slot.grid, force);
  return applyGrid(
    state,
    { ...slot, grid: placed.grid, moves: slot.moves + 1, hintsUsed: slot.hintsUsed + 1 },
    today,
    line,
    charged,
    { look: null },
  );
}

function switchCampaign(state: GameState): GameState {
  if (state.surface === "daily") return state;
  if (state.mode === "campaign") return state;
  return { ...state, mode: "campaign", undo: [], coachLine: "", look: null };
}

function switchPractice(state: GameState, puzzle: PuzzleView): GameState {
  if (state.surface === "daily") return state;
  if (state.mode === "practice") return state;
  const practice = state.practice ?? freshSlot(puzzle);
  return { ...state, mode: "practice", practice, undo: [], coachLine: "", look: null };
}

function playDaily(state: GameState, day: string, puzzle?: PuzzleView): GameState {
  if (state.daily?.day === day) {
    return state.surface === "daily" ? state : { ...state, surface: "daily", look: null };
  }
  if (!puzzle) return state;
  return {
    ...state,
    surface: "daily",
    look: null,
    daily: {
      day,
      puzzle,
      grid: cloneGrid(puzzle.givens),
      won: false,
      elapsedMs: 0,
      hintsUsed: 0,
      clean: true,
      coachLine: "",
      undo: [],
    },
  };
}

function bankDaily(state: GameState, ms: number): GameState {
  if (state.surface !== "daily" || !state.daily || state.daily.won) return state;
  if (!Number.isFinite(ms) || ms < 1) return state;
  return { ...state, daily: { ...state.daily, elapsedMs: state.daily.elapsedMs + Math.floor(ms) } };
}

function dailyFrame(state: GameState, daily: DailyBoard): DailyUndo {
  return {
    grid: cloneGrid(daily.grid),
    coachLine: daily.coachLine,
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    won: daily.won,
    hintsUsed: daily.hintsUsed,
  };
}

function pushDaily(state: GameState, daily: DailyBoard, patch: Partial<GameState>): GameState {
  const before = state.daily;
  if (!before) return state;
  const undo = [...before.undo, dailyFrame(state, before)].slice(-UNDO_LIMIT);
  return { ...state, ...patch, daily: { ...daily, undo } };
}

function dailyApply(
  state: GameState,
  daily: DailyBoard,
  today: string,
  coachLine: string,
  pointsAfterMove: number,
): GameState {
  if (!isSolved(daily.grid, daily.puzzle.rules)) {
    return pushDaily(state, { ...daily, won: false, coachLine }, { points: pointsAfterMove });
  }
  const award = awardCompletion(
    {
      points: pointsAfterMove,
      puzzleStreak: state.puzzleStreak,
      dailyStreak: state.dailyStreak,
      lastCompletionDay: state.lastCompletionDay,
    },
    daily.puzzle.size,
    today,
  );
  const solvedLine = coachLine ? `${coachLine} Solved. +${award.earned} points.` : `Solved. +${award.earned} points.`;
  return pushDaily(state, { ...daily, won: true, coachLine: solvedLine }, {
    points: award.points,
    puzzleStreak: award.puzzleStreak,
    dailyStreak: award.dailyStreak,
    lastCompletionDay: award.lastCompletionDay,
  });
}

function dailyTap(state: GameState, daily: DailyBoard, row: number, col: number, today: string): GameState {
  if (daily.won) return state;
  const grid = daily.grid;
  if (row < 0 || col < 0 || row >= grid.length || col >= grid[0].length) return state;
  if (daily.puzzle.givens[row][col] != null) {
    return { ...state, daily: { ...daily, coachLine: "That cell is given." } };
  }
  if (state.selected === "erase") {
    if (grid[row][col] == null) return state;
    const next = cloneGrid(grid);
    next[row][col] = null;
    return pushDaily(state, { ...daily, grid: next, won: false, coachLine: "" }, {});
  }
  if (grid[row][col] === state.selected) return state;
  const placed = placeDigit(grid, row, col, state.selected, daily.puzzle.rules);
  if (!placed.ok) {
    return { ...state, daily: { ...daily, clean: false, coachLine: placed.rejection.message } };
  }
  return dailyApply(state, { ...daily, grid: placed.grid }, today, "", state.points);
}

function dailyUndo(state: GameState, daily: DailyBoard): GameState {
  const previous = daily.undo[daily.undo.length - 1];
  if (!previous) return state;
  return {
    ...state,
    points: previous.points,
    puzzleStreak: previous.puzzleStreak,
    dailyStreak: previous.dailyStreak,
    lastCompletionDay: previous.lastCompletionDay,
    daily: {
      ...daily,
      grid: cloneGrid(previous.grid),
      won: previous.won,
      hintsUsed: previous.hintsUsed,
      coachLine: previous.coachLine,
      undo: daily.undo.slice(0, -1),
    },
  };
}

function dailyReset(state: GameState, daily: DailyBoard): GameState {
  const started = !gridsEqual(daily.grid, daily.puzzle.givens);
  return {
    ...state,
    puzzleStreak: started ? 0 : state.puzzleStreak,
    daily: {
      ...daily,
      grid: cloneGrid(daily.puzzle.givens),
      won: false,
      undo: [],
      coachLine: started ? "Puzzle streak reset." : "Back to the givens.",
    },
    look: null,
  };
}

function dailyHint(state: GameState, daily: DailyBoard, today: string): GameState {
  if (daily.won) return state;
  const ready = state.look ? forceOnLook(daily.grid, daily.puzzle.rules, state.look) : null;
  if (state.look && ready) {
    const cost = hintCost(daily.puzzle.tier);
    if (state.points < cost) return { ...state, daily: { ...daily, coachLine: `A hint costs ${cost} points.` } };
    const placed = placeDigit(daily.grid, ready.row, ready.col, ready.digit, daily.puzzle.rules);
    if (!placed.ok) return { ...state, daily: { ...daily, coachLine: placed.rejection.message } };
    const line = explainForce(daily.grid, ready);
    const charged = chargeHint(state.points, daily.puzzle.tier);
    return { ...dailyApply(state, { ...daily, grid: placed.grid, hintsUsed: daily.hintsUsed + 1 }, today, line, charged), look: null };
  }
  const look = findLook(daily.grid, daily.puzzle.rules);
  if (!look) {
    return { ...state, look: null, daily: { ...daily, coachLine: "No forced cell. That hint was free." } };
  }
  return { ...state, look, daily: { ...daily, coachLine: lookSentence(look) } };
}
