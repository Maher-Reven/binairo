import { findForces } from "./techniques";
import { isSolved, rejectionForGrid } from "./rules";
import type { Digit, Grid, RuleId } from "./types";

/**
 * Counts completions under the rules in force and stops at `limit`.
 * Forced techniques are applied before any branch, so a technique-solved
 * board reports 1 without guessing.
 */
export function countSolutions(grid: Grid, rules: readonly RuleId[], limit = 2): number {
  const working = grid.map((row) => row.slice());
  let count = 0;
  let nodes = 0;
  const nodeLimit = 100_000;

  const undo = (log: { r: number; c: number }[]): void => {
    for (let i = log.length - 1; i >= 0; i--) {
      working[log[i].r][log[i].c] = null;
    }
  };

  const propagate = (log: { r: number; c: number }[]): boolean => {
    const cap = working.length * (working[0]?.length ?? 0) + 1;
    for (let pass = 0; pass < cap; pass++) {
      const scan = findForces(working, rules);
      if (scan.contradiction) return false;
      let applied = false;
      for (const force of scan.forces) {
        if (working[force.row][force.col] == null) {
          working[force.row][force.col] = force.digit;
          log.push({ r: force.row, c: force.col });
          applied = true;
        }
      }
      if (!applied) return true;
    }
    return false;
  };

  const firstEmpty = (): { r: number; c: number } | null => {
    for (let r = 0; r < working.length; r++) {
      for (let c = 0; c < working[r].length; c++) {
        if (working[r][c] == null) return { r, c };
      }
    }
    return null;
  };

  const visit = (): void => {
    if (count >= limit || nodes > nodeLimit) return;
    nodes++;
    const log: { r: number; c: number }[] = [];
    if (!propagate(log)) {
      undo(log);
      return;
    }
    const hole = firstEmpty();
    if (!hole) {
      if (isSolved(working, rules)) count++;
      undo(log);
      return;
    }
    for (const digit of [0, 1] as const satisfies readonly Digit[]) {
      working[hole.r][hole.c] = digit;
      if (rejectionForGrid(working, rules) == null) visit();
      working[hole.r][hole.c] = null;
      if (count >= limit || nodes > nodeLimit) break;
    }
    undo(log);
  };

  visit();
  return count;
}
