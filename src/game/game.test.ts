import { describe, expect, it } from "vitest";
import { LESSONS } from "../domain/campaign";
import { dailySeed, dailyShareLine } from "../domain/daily";
import { completionPoints } from "../domain/scoring";
import { finishNext, finishSummary } from "./finish";
import { activeSlot, createGame, reduce } from "./reduce";
import { dailyPuzzle } from "./puzzles";
import type { GameState, PuzzleView } from "./types";
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

function hintFill(state: GameState, today = TODAY): GameState {
  return reduce(reduce(state, { type: "hint", today }), { type: "hint", today });
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

  it("explains a daily hint without charging or touching stars", () => {
    const started = reduce(createGame(linePuzzle()), {
      type: "play-daily",
      day: "2026-11-20",
      puzzle: linePuzzle(),
    });
    const hinted = hintFill(started, "2026-11-20");
    expect(hinted.daily?.coachLine).toBe("No-triple forces 0, because 1 1 _ would be three 1s in a row.");
    expect(hinted.points).toBe(0);
    expect(hinted.daily?.hintsUsed).toBe(1);
    expect(hinted.stars).toEqual(started.stars);
    expect(hinted.savedTiers).toEqual(started.savedTiers);
    expect(hinted.dailyStreak).toBe(started.dailyStreak);
    expect(hinted.campaign.grid).toEqual(started.campaign.grid);
  });

  it("gives a junior hint for free and explains the technique", () => {
    const hinted = hintFill(createGame(linePuzzle()));
    expect(activeSlot(hinted).grid[0][2]).toBe(0);
    expect(hinted.points).toBe(0);
    expect(hinted.coachLine).toBe("No-triple forces 0, because 1 1 _ would be three 1s in a row.");
  });

  it("charges a medium hint and refuses one the player cannot afford", () => {
    const rich = { ...createGame(linePuzzle("medium")), points: 12 };
    const hinted = hintFill(rich);
    expect(hinted.points).toBe(2);
    expect(activeSlot(hinted).grid[0][2]).toBe(0);
    const undone = reduce(hinted, { type: "undo" });
    expect(undone.points).toBe(12);
    expect(activeSlot(undone).grid[0][2]).toBeNull();

    const looked = reduce(createGame(linePuzzle("medium")), { type: "hint", today: TODAY });
    const broke = reduce(looked, { type: "hint", today: TODAY });
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

  it("starts a new tier and keeps the board that was left behind", () => {
    const won = playToWin();
    const puzzle = linePuzzle("medium");
    puzzle.id = "grid8";
    const next = reduce(won, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle, campaignIndex: 4 },
    });
    expect(next.tier).toBe("medium");
    expect(next.points).toBe(66);
    expect(next.puzzleStreak).toBe(1);
    expect(next.dailyStreak).toBe(1);
    expect(next.lastCompletionDay).toBe(TODAY);
    expect(next.mode).toBe("campaign");
    expect(next.campaignIndex).toBe(4);
    expect(next.campaign.puzzle).toBe(puzzle);
    expect(next.campaign.won).toBe(false);
    expect(next.campaign.grid).toEqual(puzzle.givens);
    expect(next.practice).toBeNull();
    expect(next.undo).toEqual([]);
    expect(next.savedTiers.junior?.campaign.won).toBe(true);
    expect(next.savedTiers.junior?.campaign.grid).toEqual([[1, 1, 0, 1, 0, 0]]);
    expect(next.savedTiers.medium).toBeUndefined();
  });

  it("resumes a tier's board and does not overwrite the one just left", () => {
    const won = playToWin();
    const puzzle = linePuzzle("medium");
    puzzle.id = "grid8";
    const medium = reduce(won, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle, campaignIndex: 4 },
    });
    const played = reduce(reduce(medium, { type: "select", tool: 0 }), {
      type: "tap",
      row: 0,
      col: 2,
      today: TODAY,
    });
    const freshJunior = linePuzzle();
    freshJunior.id = "replacement";
    const back = reduce(played, {
      type: "choose-tier",
      tier: "junior",
      fresh: { mode: "campaign", puzzle: freshJunior, campaignIndex: 0 },
    });
    expect(back.tier).toBe("junior");
    expect(activeSlot(back).won).toBe(true);
    expect(activeSlot(back).grid).toEqual([[1, 1, 0, 1, 0, 0]]);
    expect(back.savedTiers.medium?.campaign.puzzle.id).toBe("grid8");
    expect(back.savedTiers.medium?.campaign.grid[0][2]).toBe(0);
    expect(back.points).toBe(66);
  });

  it("choosing the open tier leaves that board in place", () => {
    const moved = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const again = reduce(moved, {
      type: "choose-tier",
      tier: "junior",
      fresh: { mode: "campaign", puzzle: linePuzzle(), campaignIndex: 0 },
    });
    expect(again).toBe(moved);
  });

  it("resets only the current tier's board", () => {
    const junior = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const puzzle = linePuzzle("medium");
    puzzle.id = "grid8";
    const medium = reduce(junior, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle, campaignIndex: 4 },
    });
    const started = reduce(medium, { type: "tap", row: 0, col: 2, today: TODAY });
    const reset = reduce(started, { type: "reset" });
    expect(reset.tier).toBe("medium");
    expect(activeSlot(reset).grid).toEqual(puzzle.givens);
    expect(reset.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(reset.puzzleStreak).toBe(0);
  });

  it("starts practice for a tier that has no saved board and keeps the other tier", () => {
    const won = playToWin();
    const puzzle = linePuzzle("advanced");
    puzzle.id = "practice-advanced";
    const dormant = linePuzzle();
    dormant.id = "dormant";
    const next = reduce(won, {
      type: "choose-tier",
      tier: "advanced",
      fresh: { mode: "practice", puzzle, campaign: dormant, campaignIndex: 0 },
    });
    expect(next.tier).toBe("advanced");
    expect(next.mode).toBe("practice");
    expect(next.points).toBe(66);
    expect(activeSlot(next).puzzle).toBe(puzzle);
    expect(activeSlot(next).grid).toEqual(puzzle.givens);
    expect(next.campaign.puzzle.id).toBe("dormant");
    expect(next.savedTiers.junior?.campaign.grid).toEqual([[1, 1, 0, 1, 0, 0]]);
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

describe("undo", () => {
  it("undoes a legal placement and an erase, one cell at a time", () => {
    const start = createGame(linePuzzle());
    const placed = reduce(start, { type: "tap", row: 0, col: 2, today: TODAY });
    expect(activeSlot(placed).grid[0][2]).toBe(0);
    expect(placed.undo).toHaveLength(1);
    expect(placed.points).toBe(0);
    expect(placed.puzzleStreak).toBe(0);
    expect(placed.stars).toEqual({});

    const erased = reduce(reduce(placed, { type: "select", tool: "erase" }), {
      type: "tap",
      row: 0,
      col: 2,
      today: TODAY,
    });
    expect(activeSlot(erased).grid[0][2]).toBeNull();
    expect(erased.points).toBe(0);
    expect(erased.puzzleStreak).toBe(0);

    const restored = reduce(erased, { type: "undo" });
    expect(activeSlot(restored).grid[0][2]).toBe(0);
    expect(restored.points).toBe(0);
    expect(restored.puzzleStreak).toBe(0);
    expect(restored.stars).toEqual({});

    const cleared = reduce(restored, { type: "undo" });
    expect(activeSlot(cleared).grid).toEqual(start.campaign.grid);
    expect(cleared.undo).toHaveLength(0);
    expect(cleared.points).toBe(0);
    expect(cleared.puzzleStreak).toBe(0);
  });

  it("does not refund a hint or move the streak when a later placement is undone", () => {
    const puzzle = linePuzzle("medium");
    const rich = { ...createGame(puzzle), points: 40, puzzleStreak: 3 };
    const hinted = hintFill(rich);
    expect(hinted.points).toBe(30);
    expect(activeSlot(hinted).grid[0][2]).toBe(0);
    const placed = reduce(reduce(hinted, { type: "select", tool: 1 }), {
      type: "tap",
      row: 0,
      col: 3,
      today: TODAY,
    });
    expect(activeSlot(placed).won).toBe(true);
    const undone = reduce(placed, { type: "undo" });
    expect(activeSlot(undone).grid[0][3]).toBeNull();
    expect(activeSlot(undone).grid[0][2]).toBe(0);
    expect(undone.points).toBe(30);
    expect(undone.puzzleStreak).toBe(3);
    expect(undone.stars).toEqual(rich.stars);
    expect(undone.daily).toEqual(rich.daily);
  });

  it("does nothing when this board has no placement to undo", () => {
    const start = createGame(linePuzzle());
    expect(reduce(start, { type: "undo" })).toBe(start);

    const rejected = reduce(reduce(start, { type: "select", tool: 1 }), {
      type: "tap",
      row: 0,
      col: 2,
      today: TODAY,
    });
    expect(rejected.undo).toHaveLength(0);
    expect(activeSlot(rejected).grid[0][2]).toBeNull();
    expect(reduce(rejected, { type: "undo" })).toBe(rejected);

    const erased = reduce(reduce(start, { type: "select", tool: "erase" }), {
      type: "tap",
      row: 0,
      col: 2,
      today: TODAY,
    });
    expect(erased.undo).toHaveLength(0);
    expect(reduce(erased, { type: "undo" })).toBe(erased);
    expect(erased.puzzleStreak).toBe(0);
  });

  it("keeps undo when the tier is saved and opened again", async () => {
    const placed = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const other = linePuzzle("medium");
    other.id = "held";
    const left = reduce(placed, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle: other, campaignIndex: 4 },
    });
    const store = memoryStore();
    await saveGame(store, left);
    const loaded = await loadGame(store);
    expect(loaded?.savedTiers.junior?.undo).toHaveLength(1);
    const back = reduce(loaded!, { type: "choose-tier", tier: "junior" });
    expect(back.tier).toBe("junior");
    expect(back.undo).toHaveLength(1);
    expect(activeSlot(back).grid[0][2]).toBe(0);
    expect(back.points).toBe(0);
    expect(back.puzzleStreak).toBe(0);
    const undone = reduce(back, { type: "undo" });
    expect(activeSlot(undone).grid[0][2]).toBeNull();
    expect(undone.undo).toHaveLength(0);
    expect(undone.points).toBe(0);
    expect(undone.puzzleStreak).toBe(0);
    expect(undone.stars).toEqual({});
  });

  it("clears only this board's undo history on reset", () => {
    const placed = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const other = linePuzzle("medium");
    other.id = "kept";
    const medium = reduce(placed, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle: other, campaignIndex: 4 },
    });
    const started = reduce(medium, { type: "tap", row: 0, col: 2, today: TODAY });
    expect(started.undo).toHaveLength(1);
    const reset = reduce(started, { type: "reset" });
    expect(reset.undo).toEqual([]);
    expect(activeSlot(reset).grid).toEqual(other.givens);
    expect(reduce(reset, { type: "undo" })).toBe(reset);
    expect(reset.savedTiers.junior?.undo).toHaveLength(1);
    expect(reset.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(reset.points).toBe(0);
    expect(reset.stars).toEqual(started.stars);
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
    const raw = JSON.parse(serialize(state)) as {
      tier: "junior";
      tiers: { junior: { campaign: { grid: (number | null)[][] } } };
    };
    raw.tiers[raw.tier].campaign.grid[0][0] = null;
    const loaded = hydrate(JSON.stringify(raw));
    expect(loaded?.campaign.grid[0][0]).toBe(1);
  });

  it("keeps each tier's board in the save", async () => {
    const junior = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const puzzle = linePuzzle("medium");
    puzzle.id = "grid8";
    const medium = reduce(junior, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle, campaignIndex: 4 },
    });
    const store = memoryStore();
    await saveGame(store, medium);
    const loaded = await loadGame(store);
    expect(loaded).toEqual(medium);
    expect(loaded?.tier).toBe("medium");
    expect(loaded?.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(loaded?.campaign.grid).toEqual(puzzle.givens);
  });

  it("loads a version 1 save as that board's tier", () => {
    const state = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const legacy = {
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
    const loaded = hydrate(JSON.stringify(legacy));
    expect(loaded?.tier).toBe("junior");
    expect(loaded?.savedTiers).toEqual({});
    expect(loaded?.campaign.grid[0][2]).toBe(0);
    expect(loaded?.points).toBe(0);
  });
});

describe("daily board", () => {
  it("builds the same board from the date", () => {
    const first = dailyPuzzle("2026-11-20");
    const second = dailyPuzzle("2026-11-20");
    expect(first.seed).toBe(dailySeed("2026-11-20"));
    expect(first.size).toBe(6);
    expect(first.rules).toEqual(["no-triple", "balance", "unique"]);
    expect(second.givens).toEqual(first.givens);
    expect(second.seed).toBe(first.seed);
    expect(dailySeed("2026-11-21")).not.toBe(first.seed);
    const line = dailyShareLine({ day: "2026-11-20", elapsedMs: 125000, hintsUsed: 0, clean: true });
    for (const row of first.givens) {
      const digits = row.map((cell) => (cell == null ? "" : String(cell))).join("");
      if (digits.length >= 3) expect(line.includes(digits)).toBe(false);
    }
  }, 30000);

  it("plays beside the tier boards and does not replace them", () => {
    const junior = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const mediumPuzzle = linePuzzle("medium");
    mediumPuzzle.id = "grid8";
    const medium = reduce(junior, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle: mediumPuzzle, campaignIndex: 4 },
    });
    const daily = reduce(medium, { type: "play-daily", day: "2026-11-20", puzzle: linePuzzle() });
    expect(daily.surface).toBe("daily");
    expect(daily.tier).toBe("medium");
    expect(daily.campaign.grid).toEqual(medium.campaign.grid);
    expect(daily.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(daily.undo).toEqual(medium.undo);
    expect(daily.coachLine).toBe(medium.coachLine);

    const played = reduce(daily, { type: "select", tool: 0 });
    const moved = reduce(played, { type: "tap", row: 0, col: 2, today: TODAY });
    expect(moved.daily?.grid[0][2]).toBe(0);
    expect(moved.daily?.clean).toBe(true);
    expect(moved.campaign.grid).toEqual(medium.campaign.grid);
    expect(moved.savedTiers).toEqual(medium.savedTiers);
    expect(moved.coachLine).toBe(medium.coachLine);

    const rejected = reduce(reduce(daily, { type: "select", tool: 1 }), {
      type: "tap",
      row: 0,
      col: 2,
      today: TODAY,
    });
    expect(rejected.daily?.clean).toBe(false);
    expect(rejected.daily?.grid[0][2]).toBeNull();
    expect(rejected.daily?.undo).toHaveLength(0);
    expect(rejected.coachLine).toBe(medium.coachLine);
    expect(rejected.campaign.grid).toEqual(medium.campaign.grid);

    const hinted = hintFill(reduce(daily, { type: "select", tool: 0 }));
    expect(hinted.daily?.hintsUsed).toBe(1);
    expect(hinted.daily?.grid[0][2]).toBe(0);
    expect(hinted.points).toBe(medium.points);
    expect(hinted.undo).toEqual(medium.undo);
    const undone = reduce(hinted, { type: "undo" });
    expect(undone.daily?.hintsUsed).toBe(0);
    expect(undone.daily?.grid[0][2]).toBeNull();
    expect(undone.campaign.grid[0]).toEqual(medium.campaign.grid[0]);

    const resumed = reduce(moved, { type: "choose-tier", tier: "medium" });
    expect(resumed.surface).toBe("tier");
    expect(activeSlot(resumed).grid).toEqual(medium.campaign.grid);
    expect(resumed.daily?.grid[0][2]).toBe(0);
    const sameDay = reduce(resumed, { type: "play-daily", day: "2026-11-20" });
    expect(sameDay.surface).toBe("daily");
    expect(sameDay.daily?.grid).toEqual(moved.daily?.grid);
    expect(sameDay.campaign.grid).toEqual(medium.campaign.grid);

    const other = linePuzzle();
    other.id = "tomorrow";
    const tomorrow = reduce(sameDay, { type: "play-daily", day: "2026-11-21", puzzle: other });
    expect(tomorrow.daily?.day).toBe("2026-11-21");
    expect(tomorrow.daily?.puzzle.id).toBe("tomorrow");
    expect(tomorrow.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(tomorrow.campaign.grid).toEqual(medium.campaign.grid);

    const reset = reduce(moved, { type: "reset" });
    expect(reset.daily?.grid).toEqual(linePuzzle().givens);
    expect(reset.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(reset.campaign.grid).toEqual(medium.campaign.grid);
    expect(reset.undo).toEqual(medium.undo);
  });

  it("shares a finished daily board without the digits", () => {
    let state = reduce(createGame(linePuzzle()), { type: "play-daily", day: "2026-11-20", puzzle: linePuzzle() });
    state = reduce(state, { type: "bank-daily", ms: 125000 });
    state = reduce(state, { type: "tap", row: 0, col: 2, today: TODAY });
    state = reduce(state, { type: "select", tool: 1 });
    state = reduce(state, { type: "tap", row: 0, col: 3, today: TODAY });
    expect(state.daily?.won).toBe(true);
    expect(state.daily?.clean).toBe(true);
    expect(state.points).toBe(66);
    const line = dailyShareLine({
      day: state.daily!.day,
      elapsedMs: state.daily!.elapsedMs,
      hintsUsed: state.daily!.hintsUsed,
      clean: state.daily!.clean,
    });
    expect(line).toBe("Binairo 2026-11-20 · 2:05 · 0 hints · clean");
    expect(line.includes("110100")).toBe(false);
    expect(state.campaign.grid).toEqual(linePuzzle().givens);
  });

  it("round-trips the daily board and still loads a save that has none", async () => {
    const junior = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: TODAY });
    const daily = reduce(reduce(junior, { type: "play-daily", day: "2026-11-20", puzzle: linePuzzle() }), {
      type: "bank-daily",
      ms: 4000,
    });
    const store = memoryStore();
    await saveGame(store, daily);
    const loaded = await loadGame(store);
    expect(loaded).toEqual(daily);
    expect(loaded?.surface).toBe("daily");
    expect(loaded?.campaign.grid[0][2]).toBe(0);

    const raw = JSON.parse(serialize(junior)) as { surface?: string; daily?: unknown };
    delete raw.surface;
    delete raw.daily;
    const older = hydrate(JSON.stringify(raw));
    expect(older?.surface).toBe("tier");
    expect(older?.daily).toBeNull();
    expect(older?.campaign.grid[0][2]).toBe(0);
  });

  it("counts a daily finish and a tier finish as one streak, and keeps the boards", () => {
    const junior = reduce(createGame(linePuzzle()), { type: "tap", row: 0, col: 2, today: "2026-11-18" });
    const mediumPuzzle = linePuzzle("medium");
    mediumPuzzle.id = "streak-medium";
    const medium = reduce(junior, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle: mediumPuzzle, campaignIndex: 4 },
    });
    const mediumWon = winLine(medium, "2026-11-19");
    expect(mediumWon.dailyStreak).toBe(1);
    expect(mediumWon.lastCompletionDay).toBe("2026-11-19");
    expect(mediumWon.savedTiers.junior?.campaign.grid[0][2]).toBe(0);

    const shared = linePuzzle();
    shared.id = "streak-daily";
    const dailyWon = winLine(reduce(mediumWon, { type: "play-daily", day: "2026-11-20", puzzle: shared }), "2026-11-20");
    expect(dailyWon.dailyStreak).toBe(2);
    expect(dailyWon.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(dailyWon.campaign.grid).toEqual([[1, 1, 0, 1, 0, 0]]);

    const advancedPuzzle = linePuzzle("advanced");
    advancedPuzzle.id = "streak-advanced";
    const sameDay = winLine(
      reduce(dailyWon, {
        type: "choose-tier",
        tier: "advanced",
        fresh: { mode: "campaign", puzzle: advancedPuzzle, campaignIndex: 9 },
      }),
      "2026-11-20",
    );
    expect(sameDay.dailyStreak).toBe(2);
    expect(sameDay.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(sameDay.savedTiers.medium?.campaign.grid).toEqual([[1, 1, 0, 1, 0, 0]]);
    expect(sameDay.daily?.grid).toEqual([[1, 1, 0, 1, 0, 0]]);
    expect(sameDay.daily?.won).toBe(true);

    const later = linePuzzle();
    later.id = "streak-later";
    const afterGap = winLine(reduce(sameDay, { type: "new-practice", puzzle: later }), "2026-11-22");
    expect(afterGap.dailyStreak).toBe(1);
    expect(afterGap.lastCompletionDay).toBe("2026-11-22");
    expect(afterGap.savedTiers.junior?.campaign.grid[0][2]).toBe(0);
    expect(afterGap.savedTiers.medium?.campaign.grid[0][2]).toBe(0);
    expect(afterGap.daily?.won).toBe(true);
  });
});

function winLine(state: GameState, today: string) {
  const withZero = reduce(state, { type: "select", tool: 0 });
  const first = reduce(withZero, { type: "tap", row: 0, col: 2, today });
  const withOne = reduce(first, { type: "select", tool: 1 });
  return reduce(withOne, { type: "tap", row: 0, col: 3, today });
}

describe("lesson stars", () => {
  it("earns three stars on a clean finish at par with no hint", () => {
    const puzzle = linePuzzle();
    puzzle.id = "line-no-triple";
    const won = winLine(createGame(puzzle), TODAY);
    expect(won.campaign.moves).toBe(2);
    expect(won.stars["line-no-triple"]).toEqual({ clean: true, par: true, hint: true });
    expect(won.dailyStreak).toBe(1);
  });

  it("adds a missing star on replay and does not take one away", () => {
    const puzzle = linePuzzle();
    puzzle.id = "line-no-triple";
    const dirty = winLine(
      reduce(reduce(createGame(puzzle), { type: "select", tool: 1 }), { type: "tap", row: 0, col: 2, today: TODAY }),
      TODAY,
    );
    expect(dirty.campaign.clean).toBe(false);
    expect(dirty.campaign.moves).toBe(2);
    expect(dirty.stars["line-no-triple"]).toEqual({ clean: false, par: true, hint: true });

    const clean = winLine(reduce(dirty, { type: "reset" }), TODAY);
    expect(clean.stars["line-no-triple"]).toEqual({ clean: true, par: true, hint: true });

    const hinted = hintFill(reduce(clean, { type: "reset" }));
    const finished = reduce(reduce(hinted, { type: "select", tool: 1 }), { type: "tap", row: 0, col: 3, today: TODAY });
    expect(finished.campaign.hintsUsed).toBe(1);
    expect(finished.stars["line-no-triple"]).toEqual({ clean: true, par: true, hint: true });
    expect(finished.dailyStreak).toBe(1);
  });

  it("undoes a star that this finish just earned", () => {
    const puzzle = linePuzzle();
    puzzle.id = "line-no-triple";
    const won = winLine(createGame(puzzle), TODAY);
    const undone = reduce(won, { type: "undo" });
    expect(undone.stars).toEqual({});
    expect(undone.campaign.won).toBe(false);
    expect(undone.campaign.moves).toBe(1);
  });

  it("keeps stars, the daily board, and the other tier boards together", () => {
    const puzzle = linePuzzle();
    puzzle.id = "line-no-triple";
    const won = winLine(createGame(puzzle), TODAY);
    const mediumPuzzle = linePuzzle("medium");
    mediumPuzzle.id = "grid8";
    const medium = reduce(won, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle: mediumPuzzle, campaignIndex: 4 },
    });
    const daily = reduce(medium, { type: "play-daily", day: "2026-11-20", puzzle: linePuzzle() });
    const played = reduce(reduce(daily, { type: "select", tool: 0 }), { type: "tap", row: 0, col: 2, today: TODAY });
    expect(played.stars).toEqual(won.stars);
    expect(played.dailyStreak).toBe(won.dailyStreak);
    expect(played.savedTiers.junior?.campaign.grid).toEqual([[1, 1, 0, 1, 0, 0]]);
    expect(played.campaign.grid[0][2]).toBeNull();
    expect(played.daily?.grid[0][2]).toBe(0);
  });
});

describe("finish screen", () => {
  it("reports moves, par, points, and both streaks for this finish", () => {
    const puzzle = linePuzzle();
    puzzle.id = "line-no-triple";
    const won = winLine(createGame(puzzle), TODAY);
    const summary = finishSummary(won);
    expect(summary).toEqual({
      moves: 2,
      par: 2,
      stars: { clean: true, par: true, hint: true },
      earnedPoints: 66,
      points: 66,
      puzzleStreak: 1,
      dailyStreak: 1,
    });
    expect(summary?.earnedPoints).toBe(completionPoints(puzzle.size, won.puzzleStreak));

    const again = winLine(reduce(won, { type: "new-practice", puzzle: linePuzzle() }), TODAY);
    const second = finishSummary(again);
    expect(second?.moves).toBe(2);
    expect(second?.par).toBe(2);
    expect(second?.earnedPoints).toBe(completionPoints(6, 2));
    expect(second?.points).toBe(66 + 72);
    expect(second?.puzzleStreak).toBe(2);
    expect(second?.dailyStreak).toBe(1);
    expect(second?.stars).toBeNull();
  });

  it("shows the three stars this lesson finish earned", () => {
    const puzzle = linePuzzle();
    puzzle.id = "line-no-triple";
    const dirty = winLine(
      reduce(reduce(createGame(puzzle), { type: "select", tool: 1 }), { type: "tap", row: 0, col: 2, today: TODAY }),
      TODAY,
    );
    expect(finishSummary(dirty)?.stars).toEqual({ clean: false, par: true, hint: true });
    expect(dirty.stars["line-no-triple"]).toEqual({ clean: false, par: true, hint: true });

    let over = createGame(puzzle);
    over = reduce(over, { type: "tap", row: 0, col: 2, today: TODAY });
    over = reduce(reduce(over, { type: "select", tool: "erase" }), { type: "tap", row: 0, col: 2, today: TODAY });
    over = reduce(reduce(over, { type: "select", tool: 0 }), { type: "tap", row: 0, col: 2, today: TODAY });
    over = reduce(reduce(over, { type: "select", tool: 1 }), { type: "tap", row: 0, col: 3, today: TODAY });
    expect(finishSummary(over)?.moves).toBe(4);
    expect(finishSummary(over)?.par).toBe(2);
    expect(finishSummary(over)?.stars).toEqual({ clean: true, par: false, hint: true });

    const hinted = hintFill(createGame(puzzle));
    const finished = reduce(reduce(hinted, { type: "select", tool: 1 }), { type: "tap", row: 0, col: 3, today: TODAY });
    expect(finishSummary(finished)?.stars).toEqual({ clean: true, par: true, hint: false });
    expect(finishSummary(reduce(finished, { type: "undo" }))).toBeNull();
    expect(reduce(finished, { type: "undo" }).points).toBe(0);
  });

  it("hides the star row on practice and on the daily board", () => {
    const practice = winLine(reduce(createGame(linePuzzle()), { type: "switch-practice", puzzle: linePuzzle() }), TODAY);
    expect(practice.mode).toBe("practice");
    expect(finishSummary(practice)?.stars).toBeNull();
    expect(finishNext(practice)).toEqual({ kind: "practice" });

    const junior = playToWin();
    const mediumPuzzle = linePuzzle("medium");
    mediumPuzzle.id = "grid8";
    const medium = reduce(junior, {
      type: "choose-tier",
      tier: "medium",
      fresh: { mode: "campaign", puzzle: mediumPuzzle, campaignIndex: 4 },
    });
    const daily = winLine(reduce(medium, { type: "play-daily", day: "2026-11-20", puzzle: linePuzzle() }), "2026-11-20");
    expect(finishSummary(daily)?.stars).toBeNull();
    expect(finishSummary(daily)?.puzzleStreak).toBe(2);
    expect(finishSummary(daily)?.dailyStreak).toBe(2);
    expect(finishNext(daily)).toEqual({ kind: "picker" });
    expect(daily.savedTiers.junior?.campaign.won).toBe(true);
    expect(daily.campaign.grid).toEqual(medium.campaign.grid);
  });

  it("starts the next lesson in the tier, or practice, and keeps the other tiers", () => {
    const junior = playToWin();
    expect(finishNext(junior)).toEqual({ kind: "lesson", campaignIndex: 1 });

    const mediumPuzzle = linePuzzle("medium");
    mediumPuzzle.id = "grid8";
    const medium = winLine(
      reduce(junior, {
        type: "choose-tier",
        tier: "medium",
        fresh: { mode: "campaign", puzzle: mediumPuzzle, campaignIndex: 4 },
      }),
      TODAY,
    );
    expect(finishNext(medium)).toEqual({ kind: "lesson", campaignIndex: 5 });
    const next = reduce(medium, { type: "next-lesson", puzzle: linePuzzle("medium"), campaignIndex: 5 });
    expect(next.campaignIndex).toBe(5);
    expect(next.mode).toBe("campaign");
    expect(next.campaign.won).toBe(false);
    expect(next.savedTiers.junior?.campaign.grid).toEqual([[1, 1, 0, 1, 0, 0]]);

    const lastMedium = LESSONS.findIndex((lesson, index) => lesson.tier === "medium" && LESSONS[index + 1]?.tier !== "medium");
    const last = winLine(
      reduce(junior, {
        type: "choose-tier",
        tier: "medium",
        fresh: { mode: "campaign", puzzle: mediumPuzzle, campaignIndex: lastMedium },
      }),
      TODAY,
    );
    expect(finishNext(last)).toEqual({ kind: "practice" });
    const practiced = reduce(last, { type: "new-practice", puzzle: linePuzzle("medium") });
    expect(practiced.mode).toBe("practice");
    expect(practiced.tier).toBe("medium");
    expect(activeSlot(practiced).won).toBe(false);
    expect(practiced.savedTiers.junior?.campaign.won).toBe(true);
    expect(practiced.campaign.won).toBe(true);
  });
});

describe("two-step hint", () => {
  it("looks without filling, charging, or spending the no-hint star", () => {
    const puzzle = linePuzzle();
    puzzle.id = "line-no-triple";
    const looked = reduce(createGame(puzzle), { type: "hint", today: TODAY });
    expect(activeSlot(looked).grid).toEqual(puzzle.givens);
    expect(looked.points).toBe(0);
    expect(looked.campaign.hintsUsed).toBe(0);
    expect(looked.campaign.moves).toBe(0);
    expect(looked.look).toEqual({ axis: "row", index: 0, rule: "no-triple" });
    expect(looked.coachLine).toBe("Look at this row. The rule is no-triple.");

    const won = winLine(looked, TODAY);
    expect(won.stars["line-no-triple"]).toEqual({ clean: true, par: true, hint: true });
    expect(won.campaign.hintsUsed).toBe(0);
  });

  it("fills on the second tap and charges the tier cost", () => {
    const medium = { ...createGame(linePuzzle("medium")), points: 12 };
    const looked = reduce(medium, { type: "hint", today: TODAY });
    expect(looked.points).toBe(12);
    expect(activeSlot(looked).grid[0][2]).toBeNull();
    const filled = reduce(looked, { type: "hint", today: TODAY });
    expect(filled.points).toBe(2);
    expect(activeSlot(filled).grid[0][2]).toBe(0);
    expect(filled.campaign.hintsUsed).toBe(1);
    expect(filled.look).toBeNull();
    expect(filled.coachLine).toBe("No-triple forces 0, because 1 1 _ would be three 1s in a row.");

    const intermediate = hintFill({ ...createGame(linePuzzle("intermediate")), points: 25 });
    expect(intermediate.points).toBe(0);
    expect(activeSlot(intermediate).grid[0][2]).toBe(0);
    expect(intermediate.campaign.hintsUsed).toBe(1);
  });

  it("fills a junior cell for free on the second tap", () => {
    const looked = reduce(createGame(linePuzzle()), { type: "hint", today: TODAY });
    const filled = reduce(looked, { type: "hint", today: TODAY });
    expect(filled.points).toBe(0);
    expect(activeSlot(filled).grid[0][2]).toBe(0);
    expect(filled.campaign.hintsUsed).toBe(1);
    expect(filled.coachLine).toBe("No-triple forces 0, because 1 1 _ would be three 1s in a row.");
  });

  it("leaves an empty result free", () => {
    const puzzle = linePuzzle("advanced");
    puzzle.givens = [[1, null, null, null, null, 0]];
    const state = { ...createGame(puzzle), points: 40 };
    const next = reduce(state, { type: "hint", today: TODAY });
    expect(next.points).toBe(40);
    expect(next.look).toBeNull();
    expect(next.campaign.hintsUsed).toBe(0);
    expect(activeSlot(next).grid).toEqual(puzzle.givens);
    expect(next.coachLine).toBe("No forced cell. That hint was free.");
  });

  it("turns a stale look into a new look instead of a fill", () => {
    const puzzle = linePuzzle("medium");
    puzzle.givens = [[1, 1, null, null, null, null]];
    const rich = { ...createGame(puzzle), points: 30 };
    const looked = reduce(rich, { type: "hint", today: TODAY });
    expect(looked.look).toEqual({ axis: "row", index: 0, rule: "no-triple" });
    const placed = reduce(looked, { type: "tap", row: 0, col: 2, today: TODAY });
    expect(activeSlot(placed).grid[0]).toEqual([1, 1, 0, null, null, null]);
    expect(placed.look).toEqual(looked.look);
    const again = reduce(placed, { type: "hint", today: TODAY });
    expect(again.points).toBe(30);
    expect(again.campaign.hintsUsed).toBe(0);
    expect(activeSlot(again).grid[0]).toEqual([1, 1, 0, null, null, null]);
    expect(again.look).toBeNull();
    expect(again.coachLine).toBe("No forced cell. That hint was free.");

    const open = linePuzzle("intermediate");
    open.givens = [[1, null, null, null, null, null]];
    const started = { ...createGame(open), points: 50 };
    const quiet = reduce(started, { type: "hint", today: TODAY });
    expect(quiet.look).toBeNull();
    const seeded = reduce(reduce(quiet, { type: "select", tool: 1 }), { type: "tap", row: 0, col: 1, today: TODAY });
    const seen = reduce(seeded, { type: "hint", today: TODAY });
    expect(seen.look).toEqual({ axis: "row", index: 0, rule: "no-triple" });
    expect(seen.points).toBe(50);
    const undone = reduce(seen, { type: "undo" });
    const fresh = reduce(undone, { type: "hint", today: TODAY });
    expect(activeSlot(fresh).grid).toEqual(activeSlot(undone).grid);
    expect(fresh.points).toBe(50);
    expect(fresh.campaign.hintsUsed).toBe(0);
    expect(fresh.look).toBeNull();
  });
});
