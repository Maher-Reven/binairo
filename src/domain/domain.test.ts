import { describe, expect, it } from "vitest";
import { LESSONS, TIER_SIZES, tierSizeLabel, tierStart } from "./campaign";
import { countSolutions } from "./counting";
import { generatePuzzle } from "./generator";
import { cloneGrid } from "./grid";
import { isSolved, placeDigit, rejectionForGrid } from "./rules";
import { awardCompletion, completionPoints, dailyStreakLabel, hintCost } from "./scoring";
import { findHint, solveByTechniques } from "./techniques";
import type { Grid, RuleId } from "./types";

const NO_TRIPLE: RuleId[] = ["no-triple"];
const BALANCE: RuleId[] = ["balance"];
const UNIQUE: RuleId[] = ["unique"];
const ALL: RuleId[] = ["no-triple", "balance", "unique"];

function oneLine(message: string): void {
  expect(message.includes("\n")).toBe(false);
  expect(message.length).toBeGreaterThan(0);
}

describe("rules", () => {
  it("rejects three identical digits, including a filled gap", () => {
    const grid: Grid = [[1, null, 1, 0]];
    const rejected = placeDigit(grid, 0, 1, 1, NO_TRIPLE);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.rejection.rule).toBe("no-triple");
      oneLine(rejected.rejection.message);
      expect(rejected.rejection.message.startsWith("no-triple:")).toBe(true);
    }
    expect(grid[0][1]).toBeNull();

    const accepted = placeDigit(grid, 0, 1, 0, NO_TRIPLE);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.grid[0]).toEqual([1, 0, 1, 0]);

    const down: Grid = [[1], [null], [1], [0]];
    const downReject = placeDigit(down, 1, 0, 1, NO_TRIPLE);
    expect(downReject.ok).toBe(false);
    if (!downReject.ok) expect(downReject.rejection.rule).toBe("no-triple");
    const downOk = placeDigit(down, 1, 0, 0, NO_TRIPLE);
    expect(downOk.ok).toBe(true);
  });

  it("rejects a line that cannot split evenly", () => {
    const grid: Grid = [
      [0, 1, 0, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const rejected = placeDigit(grid, 0, 3, 0, BALANCE);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.rejection.rule).toBe("balance");
      oneLine(rejected.rejection.message);
    }
    expect(grid[0][3]).toBeNull();
    const accepted = placeDigit(grid, 0, 3, 1, BALANCE);
    expect(accepted.ok).toBe(true);
  });

  it("rejects a completed line that copies another", () => {
    const grid: Grid = [
      [1, 1, 0, 0],
      [1, 1, 0, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const rejected = placeDigit(grid, 1, 3, 0, UNIQUE);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.rejection.rule).toBe("unique");
      oneLine(rejected.rejection.message);
    }
    const accepted = placeDigit(grid, 1, 3, 1, UNIQUE);
    expect(accepted.ok).toBe(true);
  });

  it("names no-triple before balance when both break", () => {
    const grid: Grid = [[1, 1, null, 0]];
    const rejected = placeDigit(grid, 0, 2, 1, ALL);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.rejection.rule).toBe("no-triple");
  });

  it("does not mutate the board when a placement is illegal", () => {
    const grid: Grid = [[0, 0, null]];
    const before = cloneGrid(grid);
    placeDigit(grid, 0, 2, 0, NO_TRIPLE);
    expect(grid).toEqual(before);
    expect(rejectionForGrid([[0, 0, 0]], NO_TRIPLE)?.rule).toBe("no-triple");
  });
});

describe("solvers", () => {
  it("finishes a no-triple line without guessing", () => {
    const givens: Grid = [[1, 1, null, null, 0, 0]];
    const solved = solveByTechniques(givens, NO_TRIPLE);
    expect(solved.contradiction).toBe(false);
    expect(solved.solved).toBe(true);
    expect(solved.grid).toEqual([[1, 1, 0, 1, 0, 0]]);
    expect(solved.techniquesUsed).toEqual(["no-triple"]);
    expect(countSolutions(givens, NO_TRIPLE, 2)).toBe(1);
    expect(isSolved(solved.grid, NO_TRIPLE)).toBe(true);
  });

  it("stops at two solutions", () => {
    const givens: Grid = [[1, 1, null, null]];
    expect(countSolutions(givens, NO_TRIPLE, 2)).toBe(2);
    const hint = findHint(givens, NO_TRIPLE);
    expect(hint).toMatchObject({ row: 0, col: 2, digit: 0, technique: "no-triple" });
  });

  it("forces the other digit once a line is already half full", () => {
    const givens: Grid = [[1, 0, 1, null]];
    const solved = solveByTechniques(givens, ["balance"]);
    expect(solved.grid).toEqual([[1, 0, 1, 0]]);
    expect(solved.techniquesUsed).toEqual(["balance"]);
  });

  it("forces a line to differ from a completed copy", () => {
    const givens: Grid = [
      [1, 1, 0, 0],
      [0, 0, 1, 1],
      [1, 1, 0, null],
      [null, null, null, null],
    ];
    const solved = solveByTechniques(givens, UNIQUE);
    expect(solved.solved).toBe(false);
    expect(solved.grid[2][3]).toBe(1);
    expect(solved.techniquesUsed).toEqual(["unique"]);
    expect(findHint(givens, UNIQUE)).toMatchObject({ row: 2, col: 3, digit: 1, technique: "unique" });
  });

  it("returns no hint when nothing is forced", () => {
    expect(findHint([[1, null, null, null, null, 0]], NO_TRIPLE)).toBeNull();
  });
});

describe("generator", () => {
  it("builds the same junior board twice and does not require guessing", () => {
    const spec = {
      id: "junior",
      tier: "junior" as const,
      shape: "line" as const,
      size: 8,
      rules: NO_TRIPLE,
      seed: 101,
    };
    const first = generatePuzzle(spec);
    const second = generatePuzzle(spec);
    expect(first.givens).toEqual(second.givens);
    expect(first.solution).toEqual(second.solution);
    expect(countSolutions(first.givens, first.rules, 2)).toBe(1);
    const solved = solveByTechniques(first.givens, first.rules);
    expect(solved.solved).toBe(true);
    expect(solved.techniquesUsed.every((rule) => rule === "no-triple")).toBe(true);
    expect(solved.techniquesUsed).toContain("no-triple");
    expect(isSolved(first.solution, NO_TRIPLE)).toBe(true);
  });

  it("builds a 4×4 no-triple board the technique solver can finish", () => {
    const puzzle = generatePuzzle({
      id: "j4",
      tier: "junior",
      shape: "grid",
      size: 4,
      rules: NO_TRIPLE,
      seed: 211,
    });
    const solved = solveByTechniques(puzzle.givens, puzzle.rules);
    expect(solved.solved).toBe(true);
    expect(solved.contradiction).toBe(false);
    expect(countSolutions(puzzle.givens, puzzle.rules, 2)).toBe(1);
    expect(puzzle.techniquesRequired.includes("balance")).toBe(false);
    expect(puzzle.techniquesRequired.includes("unique")).toBe(false);
  });

  it("builds a 4×4 board that may use balance and a 6×6 board under all three rules", () => {
    const balanced = generatePuzzle({
      id: "bal",
      tier: "junior",
      shape: "grid",
      size: 4,
      rules: ["no-triple", "balance"],
      seed: 307,
    });
    expect(solveByTechniques(balanced.givens, balanced.rules).solved).toBe(true);
    expect(countSolutions(balanced.givens, balanced.rules, 2)).toBe(1);
    expect(isSolved(balanced.solution, balanced.rules)).toBe(true);

    const full = generatePuzzle({
      id: "six",
      tier: "junior",
      shape: "grid",
      size: 6,
      rules: ALL,
      seed: 401,
    });
    const solved = solveByTechniques(full.givens, full.rules);
    expect(solved.solved).toBe(true);
    expect(countSolutions(full.givens, full.rules, 2)).toBe(1);
    expect(isSolved(full.solution, ALL)).toBe(true);
  }, 20_000);
});

describe("campaign and scoring", () => {
  it("follows the lesson order and provisional hint costs", () => {
    expect(LESSONS.map((lesson) => [lesson.tier, lesson.shape, lesson.size, lesson.rules.join("+")])).toEqual([
      ["junior", "line", 8, "no-triple"],
      ["junior", "grid", 4, "no-triple"],
      ["junior", "grid", 4, "no-triple+balance"],
      ["junior", "grid", 6, "no-triple+balance+unique"],
      ["medium", "grid", 8, "no-triple+balance+unique"],
      ["medium", "grid", 10, "no-triple+balance+unique"],
      ["intermediate", "grid", 12, "no-triple+balance+unique"],
      ["intermediate", "grid", 14, "no-triple+balance+unique"],
      ["intermediate", "grid", 16, "no-triple+balance+unique"],
      ["advanced", "grid", 18, "no-triple+balance+unique"],
      ["advanced", "grid", 20, "no-triple+balance+unique"],
      ["advanced", "grid", 24, "no-triple+balance+unique"],
    ]);
    expect(hintCost("junior")).toBe(0);
    expect(hintCost("medium")).toBe(10);
    expect(hintCost("intermediate")).toBe(25);
    expect(hintCost("advanced")).toBe(40);
    expect(TIER_SIZES).toEqual({
      junior: [4, 6],
      medium: [8, 10],
      intermediate: [12, 14, 16],
      advanced: [18, 20, 24],
    });
  });

  it("starts junior at its first lesson, and a later tier at a lesson when one exists", () => {
    expect(tierStart("junior")).toEqual({ kind: "campaign", tier: "junior", campaignIndex: 0 });
    expect(tierStart("medium")).toEqual({ kind: "campaign", tier: "medium", campaignIndex: 4 });
    expect(tierStart("intermediate")).toEqual({ kind: "campaign", tier: "intermediate", campaignIndex: 6 });
    expect(tierStart("advanced")).toEqual({ kind: "campaign", tier: "advanced", campaignIndex: 9 });
    expect(tierSizeLabel("junior")).toBe("A line, then 4×4 and 6×6");
    expect(tierSizeLabel("medium")).toBe("8×8 and 10×10");
    expect(tierSizeLabel("intermediate")).toBe("12×12, 14×14, and 16×16");
    expect(tierSizeLabel("advanced")).toBe("18×18, 20×20, and 24×24");
  });

  it("starts medium and above in practice at the smallest size when that tier has no lesson", () => {
    const juniorOnly = LESSONS.filter((lesson) => lesson.tier === "junior");
    expect(tierStart("junior", [])).toEqual({ kind: "campaign", tier: "junior", campaignIndex: 0 });
    expect(tierStart("medium", juniorOnly)).toEqual({
      kind: "practice",
      tier: "medium",
      shape: "grid",
      size: 8,
      rules: ["no-triple", "balance", "unique"],
    });
    expect(tierStart("intermediate", juniorOnly)).toMatchObject({ kind: "practice", size: 12 });
    expect(tierStart("advanced", juniorOnly)).toMatchObject({ kind: "practice", size: 18, shape: "grid" });
  });

  it("scores from the streak after it increments, and caps the bonus", () => {
    expect(completionPoints(4, 1)).toBe(44);
    expect(completionPoints(6, 3)).toBe(78);
    expect(completionPoints(8, 10)).toBe(160);
    expect(completionPoints(8, 11)).toBe(160);
  });

  it("moves the daily streak only on the first completion of a new local day", () => {
    const first = awardCompletion(
      { points: 0, puzzleStreak: 0, dailyStreak: 0, lastCompletionDay: null },
      4,
      "2026-11-19",
    );
    expect(first).toMatchObject({ points: 44, puzzleStreak: 1, dailyStreak: 1, lastCompletionDay: "2026-11-19" });

    const sameDay = awardCompletion(first, 4, "2026-11-19");
    expect(sameDay.dailyStreak).toBe(1);
    expect(sameDay.puzzleStreak).toBe(2);
    expect(sameDay.earned).toBe(48);

    const nextDay = awardCompletion(sameDay, 4, "2026-11-20");
    expect(nextDay.dailyStreak).toBe(2);

    const afterGap = awardCompletion(nextDay, 4, "2026-11-22");
    expect(afterGap.dailyStreak).toBe(1);
    expect(dailyStreakLabel(0)).toBe("Daily streak: 0 days");
    expect(dailyStreakLabel(1)).toBe("Daily streak: 1 day");
    expect(dailyStreakLabel(afterGap.dailyStreak)).toBe("Daily streak: 1 day");
    expect(dailyStreakLabel(nextDay.dailyStreak)).toBe("Daily streak: 2 days");
  });
});
