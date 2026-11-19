import type { Cell, Digit, Grid } from "./types";

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    const rowA = a[r];
    const rowB = b[r];
    if (rowA.length !== rowB.length) return false;
    for (let c = 0; c < rowA.length; c++) {
      if (rowA[c] !== rowB[c]) return false;
    }
  }
  return true;
}

export function emptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () => Array<Cell>(cols).fill(null));
}

export function countHoles(grid: Grid): number {
  let holes = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell == null) holes++;
    }
  }
  return holes;
}

export function isFull(grid: Grid): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (cell == null) return false;
    }
  }
  return grid.length > 0 && grid[0].length > 0;
}

export function column(grid: Grid, index: number): Cell[] {
  const line: Cell[] = [];
  for (let r = 0; r < grid.length; r++) line.push(grid[r][index]);
  return line;
}

export function lineEquals(a: readonly Cell[], b: readonly Cell[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function isLineComplete(line: readonly Cell[]): boolean {
  for (const cell of line) {
    if (cell == null) return false;
  }
  return line.length > 0;
}

export function asDigitGrid(rows: readonly (readonly Digit[])[]): Grid {
  return rows.map((row) => row.slice());
}
