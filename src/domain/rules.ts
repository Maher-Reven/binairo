import { column, isLineComplete, lineEquals } from "./grid";
import type { Cell, Digit, Grid, Rejection, RuleId } from "./types";

export const REJECTION_MESSAGE: Record<RuleId, string> = {
  "no-triple": "no-triple: three identical digits in a line.",
  balance: "balance: that line would not split evenly.",
  unique: "unique: that line copies another.",
};

export function hasRule(rules: readonly RuleId[], rule: RuleId): boolean {
  return rules.includes(rule);
}

function tripleInLine(line: readonly Cell[]): boolean {
  for (let i = 0; i + 2 < line.length; i++) {
    const a = line[i];
    if (a != null && a === line[i + 1] && a === line[i + 2]) return true;
  }
  return false;
}

function unbalanced(line: readonly Cell[]): boolean {
  if (line.length % 2 !== 0) return false;
  const half = line.length / 2;
  let zeros = 0;
  let ones = 0;
  for (const cell of line) {
    if (cell === 0) zeros++;
    else if (cell === 1) ones++;
  }
  return zeros > half || ones > half;
}

function duplicateComplete(lines: readonly (readonly Cell[])[]): boolean {
  const complete: Cell[][] = [];
  for (const line of lines) {
    if (!isLineComplete(line)) continue;
    for (const prev of complete) {
      if (lineEquals(prev, line)) return true;
    }
    complete.push(line.slice());
  }
  return false;
}

/**
 * Immediate violations of the rules in force.
 * A partial board is legal when no line has already broken a rule.
 * Balance applies only to even-length lines, because an odd line cannot split in half.
 */
export function rejectionForGrid(grid: Grid, rules: readonly RuleId[]): Rejection | null {
  if (grid.length === 0 || grid[0].length === 0) return null;
  const cols = grid[0].length;

  if (hasRule(rules, "no-triple")) {
    for (const row of grid) {
      if (tripleInLine(row)) {
        return { rule: "no-triple", message: REJECTION_MESSAGE["no-triple"] };
      }
    }
    for (let c = 0; c < cols; c++) {
      if (tripleInLine(column(grid, c))) {
        return { rule: "no-triple", message: REJECTION_MESSAGE["no-triple"] };
      }
    }
  }

  if (hasRule(rules, "balance")) {
    for (const row of grid) {
      if (unbalanced(row)) {
        return { rule: "balance", message: REJECTION_MESSAGE.balance };
      }
    }
    for (let c = 0; c < cols; c++) {
      if (unbalanced(column(grid, c))) {
        return { rule: "balance", message: REJECTION_MESSAGE.balance };
      }
    }
  }

  if (hasRule(rules, "unique")) {
    if (duplicateComplete(grid) || duplicateComplete(columnsOf(grid))) {
      return { rule: "unique", message: REJECTION_MESSAGE.unique };
    }
  }

  return null;
}

function columnsOf(grid: Grid): Cell[][] {
  const cols: Cell[][] = [];
  for (let c = 0; c < grid[0].length; c++) cols.push(column(grid, c));
  return cols;
}

export function isSolved(grid: Grid, rules: readonly RuleId[]): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (cell == null) return false;
    }
  }
  return grid.length > 0 && rejectionForGrid(grid, rules) == null;
}

export function placeDigit(
  grid: Grid,
  row: number,
  col: number,
  digit: Digit,
  rules: readonly RuleId[],
): { ok: true; grid: Grid } | { ok: false; rejection: Rejection } {
  if (grid[row][col] === digit) return { ok: true, grid };
  const next = grid.map((line, r) => (r === row ? line.slice() : line));
  next[row][col] = digit;
  const rejection = rejectionForGrid(next, rules);
  if (rejection) return { ok: false, rejection };
  return { ok: true, grid: next };
}
