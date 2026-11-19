import { describe, expect, it } from "vitest";
import { activeSlot, createGame, reduce } from "./reduce";
import type { PuzzleView } from "./types";
import { hydrate, memoryStore, saveGame, serialize } from "../persistence/storage";
import { loadGame } from "../persistence/storage";

const TODAY = "2026-11-19";

function linePuzzle(tier: PuzzleView["tier"] = "junior"): PuzzleView {
  return {
    id: "line",
    tier,
    shape: "line",
    size: 6,
    rules: ["no-triple"],
    seed: 1,
    teach: "No three identical digits in a row.",
    givens: [[1, 1, null, null, 0, 0]],
  };
}

function playToWin(seed = linePuzzle()) {
  let state = createGame(seed);
  state = reduce(state, { type: "tap", row: 0, col: 2, today: TODAY });
  state = reduce(state, { type: "select", tool: 1 });
  state = reduce(state, { type: "tap", row: 0, col: 3, today: TODAY });
  return state;
}

describe("play", () => {
  it("refuses an illegal digit and leaves the board untouched", () => {
    const start = createGame(linePuzzle());
    const next = reduce(start, { type: "select", tool: 1 });
    const rejected = reduce(next, { type: "tap", row: 0, col: 2, today: TODAY });
    expect(activeSlot(rejected).grid).toEqual(start.campaign.grid);
    expect(rejected.coachLine.startsWith("no-triple:")).toBe(true);
    expect(rejected.coachLine.includes("\n")).toBe(false);
    expect(rejected.undo).toHaveLength(0);
    expect(rejected.points).toBe(0);
  });

  it("awards points and both streaks when the board is solved", () => {
    const won = playToWin();
    const slot = activeSlot(won);
    expect(slot.won).toBe(true);
    expect(slot.grid).toEqual([[1, 1, 0, 1, 0, 0]]);
    expect(won.points).toBe(66);
    expect(won.puzzleStreak).toBe(1);
    expect(won.dailyStreak).toBe(1);
    expect(won.lastCompletionDay).toBe(TODAY);
    expect(won.coachLine).toBe("Solved. +66 points.");
  });

  it("does not move the daily streak twice on the same day", () => {
    const won = playToWin();
    const again = reduce(reduce(won, { type: "new-practice", puzzle: linePuzzle() }), { type: "select", tool: 0 });
    const placed = reduce(again, { type: "tap", row: 0, col: 2, today: TODAY });
    const second = reduce(reduce(placed, { type: "select", tool: 1 }), {
      type: "tap",
      row: 0,
      col: 3,
      today: TODAY,
    });
    expect(second.dailyStreak).toBe(1);
    expect(second.puzzleStreak).toBe(2);
    expect(second.points).toBe(66 + 72);
  });

  it("undoes a win, including the points", () => {
    const won = playToWin();
    const undone = reduce(won, { type: "undo" });
    expect(activeSlot(undone).won).toBe(false);
    expect(activeSlot(undone).grid[0][3]).toBeNull();
    expect(undone.points).toBe(0);
    expect(undone.puzzleStreak).toBe(0);
    expect(undone.dailyStreak).toBe(0);
  });

  it("gives a junior hint for free and names the technique", () => {
    const hinted = reduce(createGame(linePuzzle()), { type: "hint", today: TODAY });
    expect(activeSlot(hinted).grid[0][2]).toBe(0);
    expect(hinted.points).toBe(0);
    expect(hinted.coachLine).toBe("Hint: no-triple places 0.");
  });

  it("charges a medium hint and refuses one the player cannot afford", () => {
    const rich = { ...createGame(linePuzzle("medium")), points: 12 };
    const hinted = reduce(rich, { type: "hint", today: TODAY });
    expect(hinted.points).toBe(2);
    expect(activeSlot(hinted).grid[0][2]).toBe(0);
    const undone = reduce(hinted, { type: "undo" });
    expect(undone.points).toBe(12);
    expect(activeSlot(undone).grid[0][2]).toBeNull();

    const broke = reduce(createGame(linePuzzle("medium")), { type: "hint", today: TODAY });
    expect(broke.points).toBe(0);
    expect(activeSlot(broke).grid[0][2]).toBeNull();
    expect(broke.coachLine).toBe("A hint costs 10 points.");
  });

  it("does not charge a hint that finds nothing", () => {
    const puzzle = linePuzzle("medium");
    puzzle.givens = [[1, null, null, null, null, 0]];
    const state = { ...createGame(puzzle), points: 15 };
    const next = reduce(state, { type: "hint", today: TODAY });
    expect(next.points).toBe(15);
    expect(next.coachLine).toBe("No forced cell. That hint was free.");
  });

  it("resets the puzzle streak only after the board was started", () => {
    const started = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const withStreak = { ...started, puzzleStreak: 4 };
    const reset = reduce(withStreak, { type: "reset" });
    expect(reset.puzzleStreak).toBe(0);
    expect(activeSlot(reset).grid).toEqual(linePuzzle().givens);
    expect(reset.coachLine).toBe("Puzzle streak reset.");

    const fresh = reduce({ ...createGame(linePuzzle()), puzzleStreak: 4 }, { type: "reset" });
    expect(fresh.puzzleStreak).toBe(4);
    expect(fresh.coachLine).toBe("Back to the givens.");
  });

  it("keeps campaign progress when switching to practice and back", () => {
    const moved = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const practice = linePuzzle();
    practice.id = "practice";
    practice.givens = [[0, 0, null, null, 1, 1]];
    const switched = reduce(moved, { type: "switch-practice", puzzle: practice });
    expect(switched.mode).toBe("practice");
    expect(switched.undo).toHaveLength(0);
    expect(activeSlot(switched).grid).toEqual(practice.givens);
    const back = reduce(switched, { type: "switch-campaign" });
    expect(back.mode).toBe("campaign");
    expect(activeSlot(back).grid[0][2]).toBe(0);
  });

  it("rejects a copied row", () => {
    const puzzle: PuzzleView = {
      id: "copy",
      tier: "junior",
      shape: "grid",
      size: 4,
      rules: ["unique"],
      seed: 2,
      teach: "Rows must differ.",
      givens: [
        [1, 1, 0, 0],
        [1, 1, 0, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
    };
    const rejected = reduce(createGame(puzzle), { type: "tap", row: 1, col: 3, today: TODAY });
    expect(rejected.coachLine.startsWith("unique:")).toBe(true);
    expect(activeSlot(rejected).grid[1][3]).toBeNull();
  });
});

describe("persistence", () => {
  it("round-trips the in-progress board", async () => {
    const state = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const store = memoryStore();
    await saveGame(store, state);
    const loaded = await loadGame(store);
    expect(loaded).toEqual(state);
  });

  it("restores a given that a save tried to erase", () => {
    const state = createGame(linePuzzle());
    const raw = JSON.parse(serialize(state)) as { campaign: { grid: (number | null)[][] } };
    raw.campaign.grid[0][0] = null;
    const loaded = hydrate(JSON.stringify(raw));
    expect(loaded?.campaign.grid[0][0]).toBe(1);
  });
});
