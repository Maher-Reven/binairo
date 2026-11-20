import { describe, expect, it } from "vitest";
import { dailySeed, dailyShareLine } from "../domain/daily";
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

    const hinted = reduce(reduce(daily, { type: "select", tool: 0 }), { type: "hint", today: TODAY });
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

    const hinted = reduce(reduce(clean, { type: "reset" }), { type: "hint", today: TODAY });
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
