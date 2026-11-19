import { cloneGrid, countHoles, gridsEqual } from "./grid";
import { countSolutions } from "./counting";
import { mulberry32, type Rng } from "./rng";
import { isSolved, rejectionForGrid } from "./rules";
import { solveByTechniques } from "./techniques";
import type { Digit, GeneratedPuzzle, Grid, PuzzleSpec, RuleId } from "./types";

function nodeBudget(size: number): number {
  if (size <= 8) return 30_000;
  if (size <= 12) return 80_000;
  if (size <= 16) return 200_000;
  return 600_000;
}

function buildLine(size: number, rng: Rng): Grid {
  const line: Digit[] = [];
  const visit = (): boolean => {
    if (line.length === size) return true;
    const order: Digit[] = rng.next() < 0.5 ? [0, 1] : [1, 0];
    for (const bit of order) {
      const length = line.length;
      if (length >= 2 && line[length - 1] === bit && line[length - 2] === bit) continue;
      line.push(bit);
      if (visit()) return true;
      line.pop();
    }
    return false;
  };
  if (!visit()) throw new Error("Could not build a line.");
  return [line];
}

function buildSquare(size: number, rng: Rng, rules: readonly RuleId[]): Grid | null {
  const balance = rules.includes("balance");
  const noTriple = rules.includes("no-triple");
  const unique = rules.includes("unique");
  if (balance && size % 2 !== 0) return null;
  const half = size / 2;
  const limit = nodeBudget(size);
  let nodes = 0;

  const cols: Digit[][] = Array.from({ length: size }, () => []);
  const colOnes = Array<number>(size).fill(0);
  const colPrefix = Array<number>(size).fill(0);
  const used = new Set<number>();
  const placed: number[] = [];

  const commit = (mask: number): void => {
    for (let c = 0; c < size; c++) {
      const bit = ((mask >>> (size - 1 - c)) & 1) as Digit;
      cols[c].push(bit);
      colOnes[c] += bit;
      colPrefix[c] = ((colPrefix[c] << 1) | bit) >>> 0;
    }
    if (unique) used.add(mask);
    placed.push(mask);
  };

  const uncommit = (): void => {
    const mask = placed.pop();
    if (unique && mask != null) used.delete(mask);
    for (let c = 0; c < size; c++) {
      const bit = cols[c].pop() ?? 0;
      colOnes[c] -= bit;
      colPrefix[c] >>>= 1;
    }
  };

  const prefixesOk = (): boolean => {
    if (!unique) return true;
    const remain = size - placed.length;
    if (remain >= 8) return true;
    const capacity = 1 << remain;
    const groups = new Map<number, number>();
    for (let c = 0; c < size; c++) {
      const count = (groups.get(colPrefix[c]) ?? 0) + 1;
      if (count > capacity) return false;
      groups.set(colPrefix[c], count);
    }
    return true;
  };

  const columnsUnique = (): boolean => {
    const seen = new Set<number>();
    for (let c = 0; c < size; c++) {
      if (seen.has(colPrefix[c])) return false;
      seen.add(colPrefix[c]);
    }
    return true;
  };

  const bitOrder = (col: number): Digit[] => {
    const depth = cols[col].length;
    const ones = colOnes[col];
    const zeros = depth - ones;
    const prefer: Digit = ones < zeros ? 1 : zeros < ones ? 0 : rng.next() < 0.5 ? 0 : 1;
    return prefer === 0 ? [0, 1] : [1, 0];
  };

  const fill = (col: number, mask: number, ones: number, run: number, prev: number): boolean => {
    if (++nodes > limit) return false;
    if (col === size) {
      if (balance && ones !== half) return false;
      if (unique && used.has(mask)) return false;
      commit(mask);
      if (!prefixesOk()) {
        uncommit();
        return false;
      }
      if (placed.length === size) {
        if (!unique || columnsUnique()) return true;
        uncommit();
        return false;
      }
      if (fill(0, 0, 0, 0, -1)) return true;
      uncommit();
      return false;
    }

    for (const bit of bitOrder(col)) {
      if (noTriple && run >= 2 && prev === bit) continue;
      const onesAfter = ones + bit;
      const zerosAfter = col + 1 - onesAfter;
      if (balance) {
        if (onesAfter > half || zerosAfter > half) continue;
        const remainInRow = size - (col + 1);
        if (half - onesAfter > remainInRow || half - zerosAfter > remainInRow) continue;
      }
      const depth = cols[col].length;
      if (noTriple && depth >= 2 && cols[col][depth - 1] === bit && cols[col][depth - 2] === bit) {
        continue;
      }
      if (balance) {
        const cOnes = colOnes[col] + bit;
        const filled = depth + 1;
        const remainRows = size - filled;
        const cZeros = filled - cOnes;
        if (cOnes > half || cZeros > half) continue;
        if (half - cOnes > remainRows || half - cZeros > remainRows) continue;
      }
      const nextMask = (mask | (bit << (size - 1 - col))) >>> 0;
      const nextRun = prev === bit ? run + 1 : 1;
      if (fill(col + 1, nextMask, onesAfter, nextRun, bit)) return true;
      if (nodes > limit) return false;
    }
    return false;
  };

  if (!fill(0, 0, 0, 0, -1)) return null;
  const grid: Grid = placed.map((mask) => {
    const row: Digit[] = [];
    for (let c = 0; c < size; c++) row.push(((mask >>> (size - 1 - c)) & 1) as Digit);
    return row;
  });
  return grid;
}

function carve(solution: Grid, rules: readonly RuleId[], rng: Rng): Grid {
  const grid = cloneGrid(solution);
  const coords: { r: number; c: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) coords.push({ r, c });
  }
  for (let i = coords.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const swap = coords[i];
    coords[i] = coords[j];
    coords[j] = swap;
  }
  for (const { r, c } of coords) {
    const previous = grid[r][c];
    grid[r][c] = null;
    const solved = solveByTechniques(grid, rules);
    if (!solved.solved || !gridsEqual(solved.grid, solution)) {
      grid[r][c] = previous;
    }
  }
  return grid;
}

function tryOnce(spec: PuzzleSpec, rng: Rng): GeneratedPuzzle | null {
  const solution =
    spec.shape === "line" ? buildLine(spec.size, rng) : buildSquare(spec.size, rng, spec.rules);
  if (!solution) return null;
  if (!isSolved(solution, spec.rules) || rejectionForGrid(solution, spec.rules)) return null;
  const givens = carve(solution, spec.rules, rng);
  const solved = solveByTechniques(givens, spec.rules);
  if (!solved.solved || solved.contradiction || !gridsEqual(solved.grid, solution)) return null;
  if (countSolutions(givens, spec.rules, 2) !== 1) return null;
  return {
    ...spec,
    rules: spec.rules.slice(),
    givens,
    solution,
    techniquesRequired: solved.techniquesUsed,
  };
}

/**
 * Builds a completed valid grid, removes clues, and keeps the board only when
 * the technique solver finishes it and the counting solver finds one solution.
 */
export function generatePuzzle(spec: PuzzleSpec): GeneratedPuzzle {
  const want = spec.minHoles ?? (spec.shape === "line" ? 2 : 1);
  let best: GeneratedPuzzle | null = null;
  const attempts = spec.size >= 18 ? 12 : 40;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = mulberry32((spec.seed + attempt * 9973) >>> 0);
    const puzzle = tryOnce(spec, rng);
    if (!puzzle) continue;
    const holes = countHoles(puzzle.givens);
    if (holes >= want) return puzzle;
    if (!best || holes > countHoles(best.givens)) best = puzzle;
  }
  if (best && countHoles(best.givens) > 0) return best;
  throw new Error(`Could not generate a unique board for seed ${spec.seed}.`);
}
