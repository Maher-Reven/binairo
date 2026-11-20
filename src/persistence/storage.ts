import { cloneGrid, countHoles, gridsEqual } from "../domain/grid";
import { localDay } from "../domain/scoring";
import type { LessonStars, LessonStarsMap } from "../domain/stars";
import type { Cell, Grid, RuleId, Tier } from "../domain/types";
import { snapshotTier } from "../game/snapshot";
import type { BoardSlot, DailyBoard, DailyUndo, GameState, PuzzleView, Surface, TierSnapshot, UndoFrame } from "../game/types";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const SAVE_KEY = "binairo.save.v1";

const RULES: readonly RuleId[] = ["no-triple", "balance", "unique"];
const TIERS: readonly Tier[] = ["junior", "medium", "intermediate", "advanced"];

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = { ...initial };
  return {
    async getItem(key: string): Promise<string | null> {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      data[key] = value;
    },
  };
}

interface SavedProfile {
  version: 2;
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  lastCompletionDay: string | null;
  tier: Tier;
  tiers: Partial<Record<Tier, TierSnapshot>>;
  surface: Surface;
  daily: DailyBoard | null;
  stars: LessonStarsMap;
}

export function serialize(state: GameState): string {
  const tiers: Partial<Record<Tier, TierSnapshot>> = {
    ...state.savedTiers,
    [state.tier]: snapshotTier(state),
  };
  const saved: SavedProfile = {
    version: 2,
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    tier: state.tier,
    tiers,
    surface: state.surface,
    daily: state.daily,
    stars: state.stars,
  };
  return JSON.stringify(saved);
}

export function hydrate(raw: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version === 1) return hydrateLegacy(parsed);
    if (parsed.version === 2) return hydrateProfile(parsed);
    return null;
  } catch {
    return null;
  }
}

function hydrateLegacy(parsed: Record<string, unknown>): GameState | null {
  const snap = parseSnapshot(parsed);
  if (!snap) return null;
  const tier = snap.mode === "practice" && snap.practice ? snap.practice.puzzle.tier : snap.campaign.puzzle.tier;
  return gameFrom(snap, tier, {}, economyOf(snap), "tier", null, {});
}

function hydrateProfile(parsed: Record<string, unknown>): GameState | null {
  if (!isTier(parsed.tier) || !isRecord(parsed.tiers)) return null;
  const economy = parseEconomy(parsed);
  if (!economy) return null;
  const savedTiers: Partial<Record<Tier, TierSnapshot>> = {};
  for (const tier of TIERS) {
    const entry = parsed.tiers[tier];
    if (entry == null) continue;
    const snap = parseSnapshot(entry);
    if (snap) savedTiers[tier] = snap;
  }
  const live = savedTiers[parsed.tier];
  if (!live) return null;
  delete savedTiers[parsed.tier];
  const daily = parseDaily(parsed.daily);
  const surface: Surface = parsed.surface === "daily" && daily ? "daily" : "tier";
  return gameFrom(live, parsed.tier, savedTiers, economy, surface, daily, parseStars(parsed.stars));
}

function gameFrom(
  snap: TierSnapshot,
  tier: Tier,
  savedTiers: Partial<Record<Tier, TierSnapshot>>,
  economy: { points: number; puzzleStreak: number; dailyStreak: number; lastCompletionDay: string | null },
  surface: Surface,
  daily: DailyBoard | null,
  stars: LessonStarsMap,
): GameState {
  const ledgerMoved =
    snap.points !== economy.points ||
    snap.puzzleStreak !== economy.puzzleStreak ||
    snap.dailyStreak !== economy.dailyStreak ||
    snap.lastCompletionDay !== economy.lastCompletionDay;
  return {
    points: economy.points,
    puzzleStreak: economy.puzzleStreak,
    dailyStreak: economy.dailyStreak,
    lastCompletionDay: economy.lastCompletionDay,
    tier,
    savedTiers,
    campaignIndex: snap.campaignIndex,
    mode: snap.mode,
    selected: snap.selected,
    coachLine: snap.coachLine,
    campaign: snap.campaign,
    practice: snap.practice,
    undo: ledgerMoved ? [] : snap.undo,
    surface,
    daily,
    stars,
  };
}

function parseStars(value: unknown): LessonStarsMap {
  if (!isRecord(value)) return {};
  const stars: LessonStarsMap = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    if (typeof entry.clean !== "boolean" || typeof entry.par !== "boolean" || typeof entry.hint !== "boolean") continue;
    const record: LessonStars = { clean: entry.clean, par: entry.par, hint: entry.hint };
    stars[id] = record;
  }
  return stars;
}

function parseDaily(value: unknown): DailyBoard | null {
  if (value == null || !isRecord(value)) return null;
  if (typeof value.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  const puzzle = parsePuzzle(value.puzzle);
  const grid = parseGrid(value.grid);
  if (!puzzle || !grid || typeof value.won !== "boolean") return null;
  if (grid.length !== puzzle.givens.length || grid[0].length !== puzzle.givens[0].length) return null;
  if (typeof value.elapsedMs !== "number" || typeof value.hintsUsed !== "number" || typeof value.clean !== "boolean") {
    return null;
  }
  const undo = parseDailyUndo(value.undo);
  if (!undo) return null;
  const restored = cloneGrid(grid);
  for (let r = 0; r < puzzle.givens.length; r++) {
    for (let c = 0; c < puzzle.givens[0].length; c++) {
      const given = puzzle.givens[r][c];
      if (given != null) restored[r][c] = given;
    }
  }
  return {
    day: value.day,
    puzzle,
    grid: restored,
    won: value.won,
    elapsedMs: Math.max(0, Math.floor(value.elapsedMs)),
    hintsUsed: Math.max(0, Math.floor(value.hintsUsed)),
    clean: value.clean,
    coachLine: typeof value.coachLine === "string" ? value.coachLine : "",
    undo,
  };
}

function parseDailyUndo(value: unknown): DailyUndo[] | null {
  if (!Array.isArray(value)) return null;
  const frames: DailyUndo[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const grid = parseGrid(entry.grid);
    if (!grid || typeof entry.coachLine !== "string" || typeof entry.won !== "boolean") return null;
    if (typeof entry.points !== "number" || typeof entry.puzzleStreak !== "number") return null;
    if (typeof entry.dailyStreak !== "number" || typeof entry.hintsUsed !== "number") return null;
    const last = entry.lastCompletionDay;
    if (last != null && typeof last !== "string") return null;
    frames.push({
      grid,
      coachLine: entry.coachLine,
      points: entry.points,
      puzzleStreak: entry.puzzleStreak,
      dailyStreak: entry.dailyStreak,
      lastCompletionDay: last ?? null,
      won: entry.won,
      hintsUsed: Math.max(0, Math.floor(entry.hintsUsed)),
    });
  }
  return frames;
}

function economyOf(snap: TierSnapshot) {
  return {
    points: snap.points,
    puzzleStreak: snap.puzzleStreak,
    dailyStreak: snap.dailyStreak,
    lastCompletionDay: snap.lastCompletionDay,
  };
}

function parseEconomy(
  parsed: Record<string, unknown>,
): { points: number; puzzleStreak: number; dailyStreak: number; lastCompletionDay: string | null } | null {
  if (typeof parsed.points !== "number" || typeof parsed.puzzleStreak !== "number") return null;
  if (typeof parsed.dailyStreak !== "number") return null;
  const last = parsed.lastCompletionDay;
  if (last != null && (typeof last !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(last))) return null;
  return {
    points: parsed.points,
    puzzleStreak: parsed.puzzleStreak,
    dailyStreak: parsed.dailyStreak,
    lastCompletionDay: last ?? null,
  };
}

function parseSnapshot(value: unknown): TierSnapshot | null {
  if (!isRecord(value)) return null;
  const campaign = parseSlot(value.campaign);
  const practice = value.practice == null ? null : parseSlot(value.practice);
  if (!campaign || (value.practice != null && !practice)) return null;
  const economy = parseEconomy(value);
  if (!economy || typeof value.campaignIndex !== "number") return null;
  if (value.mode !== "campaign" && value.mode !== "practice") return null;
  if (value.mode === "practice" && !practice) return null;
  if (value.selected !== 0 && value.selected !== 1 && value.selected !== "erase") return null;
  if (typeof value.coachLine !== "string") return null;
  const undo = parseUndo(value.undo);
  if (!undo) return null;
  return {
    ...economy,
    campaignIndex: value.campaignIndex,
    mode: value.mode,
    selected: value.selected,
    coachLine: value.coachLine,
    campaign,
    practice,
    undo,
  };
}

export async function loadGame(store: KeyValueStore): Promise<GameState | null> {
  const raw = await store.getItem(SAVE_KEY);
  if (!raw) return null;
  return hydrate(raw);
}

export async function saveGame(store: KeyValueStore, state: GameState): Promise<void> {
  await store.setItem(SAVE_KEY, serialize(state));
}

export function todayFrom(date = new Date()): string {
  return localDay(date);
}

function attemptFrom(
  value: Record<string, unknown>,
  puzzle: PuzzleView,
  grid: Grid,
  won: boolean,
): { clean: boolean; moves: number; hintsUsed: number } {
  if (typeof value.clean === "boolean" && typeof value.moves === "number" && typeof value.hintsUsed === "number") {
    return {
      clean: value.clean,
      moves: Math.max(0, Math.floor(value.moves)),
      hintsUsed: Math.max(0, Math.floor(value.hintsUsed)),
    };
  }
  const started = won || !gridsEqual(grid, puzzle.givens);
  if (!started) return { clean: true, moves: 0, hintsUsed: 0 };
  return { clean: false, moves: countHoles(puzzle.givens) + 1, hintsUsed: 1 };
}

function parseSlot(value: unknown): BoardSlot | null {
  if (!isRecord(value)) return null;
  const puzzle = parsePuzzle(value.puzzle);
  const grid = parseGrid(value.grid);
  if (!puzzle || !grid || typeof value.won !== "boolean") return null;
  if (grid.length !== puzzle.givens.length || grid[0].length !== puzzle.givens[0].length) return null;
  const restored = cloneGrid(grid);
  for (let r = 0; r < puzzle.givens.length; r++) {
    for (let c = 0; c < puzzle.givens[0].length; c++) {
      const given = puzzle.givens[r][c];
      if (given != null) restored[r][c] = given;
    }
  }
  return { puzzle, grid: restored, won: value.won, ...attemptFrom(value, puzzle, restored, value.won) };
}

function parsePuzzle(value: unknown): PuzzleView | null {
  if (!isRecord(value)) return null;
  const givens = parseGrid(value.givens);
  if (!givens || typeof value.id !== "string" || typeof value.teach !== "string") return null;
  if (typeof value.size !== "number" || typeof value.seed !== "number") return null;
  if (value.shape !== "line" && value.shape !== "grid") return null;
  if (!isTier(value.tier) || !Array.isArray(value.rules) || !value.rules.every(isRule)) return null;
  return {
    id: value.id,
    tier: value.tier,
    shape: value.shape,
    size: value.size,
    rules: value.rules.slice(),
    seed: value.seed,
    teach: value.teach,
    givens,
  };
}

function parseUndo(value: unknown): UndoFrame[] | null {
  if (!Array.isArray(value)) return null;
  const frames: UndoFrame[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const grid = parseGrid(entry.grid);
    if (!grid || typeof entry.coachLine !== "string" || typeof entry.won !== "boolean") return null;
    if (typeof entry.points !== "number" || typeof entry.puzzleStreak !== "number") return null;
    if (typeof entry.dailyStreak !== "number") return null;
    const last = entry.lastCompletionDay;
    if (last != null && typeof last !== "string") return null;
    frames.push({
      grid,
      coachLine: entry.coachLine,
      points: entry.points,
      puzzleStreak: entry.puzzleStreak,
      dailyStreak: entry.dailyStreak,
      lastCompletionDay: last ?? null,
      won: entry.won,
      clean: typeof entry.clean === "boolean" ? entry.clean : true,
      moves: typeof entry.moves === "number" ? Math.max(0, Math.floor(entry.moves)) : 0,
      hintsUsed: typeof entry.hintsUsed === "number" ? Math.max(0, Math.floor(entry.hintsUsed)) : 0,
      stars: entry.stars == null ? null : parseStars(entry.stars),
    });
  }
  return frames;
}

function parseGrid(value: unknown): Grid | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const width = Array.isArray(value[0]) ? value[0].length : 0;
  if (width === 0) return null;
  const grid: Grid = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== width) return null;
    const cells: Cell[] = [];
    for (const cell of row) {
      if (cell !== 0 && cell !== 1 && cell !== null) return null;
      cells.push(cell);
    }
    grid.push(cells);
  }
  return grid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function isRule(value: unknown): value is RuleId {
  return RULES.includes(value as RuleId);
}

function isTier(value: unknown): value is Tier {
  return TIERS.includes(value as Tier);
}
