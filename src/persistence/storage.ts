import { cloneGrid } from "../domain/grid";
import { localDay } from "../domain/scoring";
import type { Cell, Grid, RuleId, Tier } from "../domain/types";
import type { BoardSlot, GameState, Mode, PuzzleView, UndoFrame } from "../game/types";

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

interface SavedGame {
  version: 1;
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  lastCompletionDay: string | null;
  campaignIndex: number;
  mode: Mode;
  selected: 0 | 1 | "erase";
  coachLine: string;
  campaign: BoardSlot;
  practice: BoardSlot | null;
  undo: UndoFrame[];
}

export function serialize(state: GameState): string {
  const saved: SavedGame = {
    version: 1,
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
    lastCompletionDay: state.lastCompletionDay,
    campaignIndex: state.campaignIndex,
    mode: state.mode,
    selected: state.selected,
    coachLine: state.coachLine,
    campaign: state.campaign,
    practice: state.practice,
    undo: state.undo,
  };
  return JSON.stringify(saved);
}

export function hydrate(raw: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    const campaign = parseSlot(parsed.campaign);
    const practice = parsed.practice == null ? null : parseSlot(parsed.practice);
    if (!campaign || (parsed.practice != null && !practice)) return null;
    if (typeof parsed.points !== "number" || typeof parsed.puzzleStreak !== "number") return null;
    if (typeof parsed.dailyStreak !== "number" || typeof parsed.campaignIndex !== "number") return null;
    if (parsed.mode !== "campaign" && parsed.mode !== "practice") return null;
    if (parsed.mode === "practice" && !practice) return null;
    if (parsed.selected !== 0 && parsed.selected !== 1 && parsed.selected !== "erase") return null;
    if (typeof parsed.coachLine !== "string") return null;
    const last = parsed.lastCompletionDay;
    if (last != null && (typeof last !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(last))) return null;
    const undo = parseUndo(parsed.undo);
    if (!undo) return null;
    return {
      points: parsed.points,
      puzzleStreak: parsed.puzzleStreak,
      dailyStreak: parsed.dailyStreak,
      lastCompletionDay: last ?? null,
      campaignIndex: parsed.campaignIndex,
      mode: parsed.mode,
      selected: parsed.selected,
      coachLine: parsed.coachLine,
      campaign,
      practice,
      undo,
    };
  } catch {
    return null;
  }
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
  return { puzzle, grid: restored, won: value.won };
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
