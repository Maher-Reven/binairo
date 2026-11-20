import { column, isLineComplete, lineEquals } from "./grid";
import { rejectionForGrid } from "./rules";
import type { Cell, Digit, Force, Grid, RuleId } from "./types";

const RULE_ORDER: readonly RuleId[] = ["no-triple", "balance", "unique"];

export interface ForceScan {
  forces: Force[];
  contradiction: boolean;
}

export interface SolveResult {
  solved: boolean;
  grid: Grid;
  techniquesUsed: RuleId[];
  contradiction: boolean;
}

/**
 * One pass of forced cells.
 * no-triple: 11_ → 0, 00_ → 1, 1_1 → 0, 0_0 → 1, and the same down a column.
 * balance: a line that already has N/2 of one digit is filled with the other.
 * uniqueness: a line one cell away from copying a completed line must differ.
 * On an even line with balance also in force, that last cell is already filled
 * by the even split, so a hint names balance when the two agree.
 */
export function findForces(grid: Grid, rules: readonly RuleId[]): ForceScan {
  if (grid.length === 0 || grid[0].length === 0) {
    return { forces: [], contradiction: false };
  }
  if (rejectionForGrid(grid, rules)) {
    return { forces: [], contradiction: true };
  }

  const enabled = new Set(rules);
  const forces: Force[] = [];
  const claimed = new Map<string, Digit>();

  const add = (row: number, col: number, digit: Digit, technique: RuleId): boolean => {
    const current = grid[row][col];
    if (current != null) return current === digit;
    const key = `${row},${col}`;
    const prev = claimed.get(key);
    if (prev != null && prev !== digit) return false;
    if (prev == null) {
      claimed.set(key, digit);
      forces.push({ row, col, digit, technique });
    }
    return true;
  };

  if (enabled.has("no-triple")) {
    for (let r = 0; r < grid.length; r++) {
      if (!applyNoTriple(grid[r], (index, digit) => add(r, index, digit, "no-triple"))) {
        return { forces: [], contradiction: true };
      }
    }
    for (let c = 0; c < grid[0].length; c++) {
      const line = column(grid, c);
      if (!applyNoTriple(line, (index, digit) => add(index, c, digit, "no-triple"))) {
        return { forces: [], contradiction: true };
      }
    }
  }

  if (enabled.has("balance")) {
    for (let r = 0; r < grid.length; r++) {
      if (!applyBalance(grid[r], (index, digit) => add(r, index, digit, "balance"))) {
        return { forces: [], contradiction: true };
      }
    }
    for (let c = 0; c < grid[0].length; c++) {
      const line = column(grid, c);
      if (!applyBalance(line, (index, digit) => add(index, c, digit, "balance"))) {
        return { forces: [], contradiction: true };
      }
    }
  }

  if (enabled.has("unique")) {
    if (!applyUniqueness(grid, (row, col, digit) => add(row, col, digit, "unique"))) {
      return { forces: [], contradiction: true };
    }
    if (!applyUniqueness(columnsAsRows(grid), (col, row, digit) => add(row, col, digit, "unique"))) {
      return { forces: [], contradiction: true };
    }
  }

  return { forces, contradiction: false };
}

function applyNoTriple(line: readonly Cell[], add: (index: number, digit: Digit) => boolean): boolean {
  for (let i = 0; i < line.length; i++) {
    if (line[i] != null) continue;
    const forced = noTripleAt(line, i);
    if (forced === "contradiction") return false;
    if (forced != null && !add(i, forced)) return false;
  }
  return true;
}

function noTripleAt(line: readonly Cell[], index: number): Digit | "contradiction" | null {
  let forced: Digit | null = null;
  const startMin = Math.max(0, index - 2);
  const startMax = Math.min(index, line.length - 3);
  for (let start = startMin; start <= startMax; start++) {
    const others: Cell[] = [];
    for (let k = 0; k < 3; k++) {
      const at = start + k;
      if (at === index) continue;
      others.push(line[at]);
    }
    if (others.length === 2 && others[0] != null && others[0] === others[1]) {
      const digit: Digit = others[0] === 1 ? 0 : 1;
      if (forced != null && forced !== digit) return "contradiction";
      forced = digit;
    }
  }
  return forced;
}

function applyBalance(line: readonly Cell[], add: (index: number, digit: Digit) => boolean): boolean {
  if (line.length % 2 !== 0) return true;
  const half = line.length / 2;
  let zeros = 0;
  let ones = 0;
  const empties: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 0) zeros++;
    else if (line[i] === 1) ones++;
    else empties.push(i);
  }
  if (zeros > half || ones > half) return false;
  if (empties.length === 0) return true;
  let digit: Digit | null = null;
  if (ones === half) digit = 0;
  else if (zeros === half) digit = 1;
  if (digit == null) return true;
  for (const index of empties) {
    if (!add(index, digit)) return false;
  }
  return true;
}

function applyUniqueness(
  lines: readonly (readonly Cell[])[],
  add: (line: number, index: number, digit: Digit) => boolean,
): boolean {
  const completed: Cell[][] = [];
  for (const line of lines) {
    if (isLineComplete(line)) completed.push(line.slice());
  }
  for (let i = 0; i < lines.length; i++) {
    const empties: number[] = [];
    for (let k = 0; k < lines[i].length; k++) {
      if (lines[i][k] == null) empties.push(k);
    }
    if (empties.length !== 1) continue;
    const index = empties[0];
    const options: Digit[] = [];
    for (const digit of [0, 1] as const) {
      const candidate = lines[i].slice();
      candidate[index] = digit;
      const copies = completed.some((done) => lineEquals(done, candidate));
      if (!copies) options.push(digit);
    }
    if (options.length === 0) return false;
    if (options.length === 1 && !add(i, index, options[0])) return false;
  }
  return true;
}

function columnsAsRows(grid: Grid): Cell[][] {
  const lines: Cell[][] = [];
  for (let c = 0; c < grid[0].length; c++) lines.push(column(grid, c));
  return lines;
}

export function solveByTechniques(grid: Grid, rules: readonly RuleId[]): SolveResult {
  const next = grid.map((row) => row.slice());
  const used = new Set<RuleId>();
  const cellCount = next.length * (next[0]?.length ?? 0);
  for (let pass = 0; pass <= cellCount; pass++) {
    const scan = findForces(next, rules);
    if (scan.contradiction) {
      return { solved: false, grid: next, techniquesUsed: ordered(used), contradiction: true };
    }
    let applied = false;
    for (const force of scan.forces) {
      if (next[force.row][force.col] == null) {
        next[force.row][force.col] = force.digit;
        used.add(force.technique);
        applied = true;
      }
    }
    if (!applied) {
      const solved = next.every((row) => row.every((cell) => cell != null)) && rejectionForGrid(next, rules) == null;
      return { solved, grid: next, techniquesUsed: ordered(used), contradiction: false };
    }
  }
  return { solved: false, grid: next, techniquesUsed: ordered(used), contradiction: true };
}

function ordered(used: Set<RuleId>): RuleId[] {
  return RULE_ORDER.filter((rule) => used.has(rule));
}

/** The first forced cell in reading order, naming the technique that forces it. */
export function findHint(grid: Grid, rules: readonly RuleId[]): Force | null {
  const scan = findForces(grid, rules);
  if (scan.contradiction || scan.forces.length === 0) return null;
  const fresh = scan.forces.filter((force) => grid[force.row][force.col] == null);
  if (fresh.length === 0) return null;
  fresh.sort((a, b) => a.row - b.row || a.col - b.col || RULE_ORDER.indexOf(a.technique) - RULE_ORDER.indexOf(b.technique));
  return fresh[0];
}

/** One sentence: which technique forced this cell, and why. */
export function explainForce(grid: Grid, force: Force): string {
  if (force.technique === "no-triple") return explainNoTriple(grid, force);
  if (force.technique === "balance") return explainBalance(grid, force);
  return explainUnique(grid, force);
}

function explainNoTriple(grid: Grid, force: Force): string {
  const other: Digit = force.digit === 1 ? 0 : 1;
  const rowPattern = triplePattern(grid[force.row], force.col);
  if (rowPattern) {
    return `No-triple forces ${force.digit}, because ${rowPattern} would be three ${other}s in a row.`;
  }
  const columnPattern = triplePattern(column(grid, force.col), force.row);
  if (columnPattern) {
    return `No-triple forces ${force.digit}, because ${columnPattern} would be three ${other}s in a column.`;
  }
  return `No-triple forces ${force.digit}, because the other digit would make three in a row.`;
}

function triplePattern(line: readonly Cell[] | undefined, index: number): string | null {
  if (!line || index < 0 || index >= line.length) return null;
  const startMin = Math.max(0, index - 2);
  const startMax = Math.min(index, line.length - 3);
  for (let start = startMin; start <= startMax; start++) {
    const shown: string[] = [];
    let pair: Digit | null = null;
    let matched = true;
    for (let offset = 0; offset < 3; offset++) {
      const at = start + offset;
      if (at === index) {
        shown.push("_");
        continue;
      }
      const value = line[at];
      if (value == null || (pair != null && pair !== value)) {
        matched = false;
        break;
      }
      pair = value;
      shown.push(String(value));
    }
    if (matched && pair != null) return shown.join(" ");
  }
  return null;
}

function explainBalance(grid: Grid, force: Force): string {
  const row = balanceOther(grid[force.row], force.col, force.digit);
  if (row != null) {
    return `Balance forces ${force.digit} in this row, because the row already holds as many ${row}s as the rule allows.`;
  }
  const down = balanceOther(column(grid, force.col), force.row, force.digit);
  if (down != null) {
    return `Balance forces ${force.digit} in this column, because the column already holds as many ${down}s as the rule allows.`;
  }
  return `Balance forces ${force.digit}, because a line already holds as many of the other digit as the rule allows.`;
}

function balanceOther(line: readonly Cell[] | undefined, index: number, digit: Digit): Digit | null {
  if (!line || line.length % 2 !== 0 || index < 0 || index >= line.length || line[index] != null) return null;
  const half = line.length / 2;
  let zeros = 0;
  let ones = 0;
  for (const cell of line) {
    if (cell === 0) zeros++;
    else if (cell === 1) ones++;
  }
  if (digit === 0 && ones === half && zeros < half) return 1;
  if (digit === 1 && zeros === half && ones < half) return 0;
  return null;
}

function explainUnique(grid: Grid, force: Force): string {
  const other: Digit = force.digit === 1 ? 0 : 1;
  if (uniqueDigit(grid, force.row, force.col) === force.digit) {
    return `Uniqueness forces ${force.digit} in this row, because ${other} would copy a finished row.`;
  }
  if (uniqueDigit(columnsAsRows(grid), force.col, force.row) === force.digit) {
    return `Uniqueness forces ${force.digit} in this column, because ${other} would copy a finished column.`;
  }
  return `Uniqueness forces ${force.digit}, because the other digit would copy a finished line.`;
}

function uniqueDigit(lines: readonly (readonly Cell[])[], lineIndex: number, index: number): Digit | null {
  const line = lines[lineIndex];
  if (!line || index < 0 || index >= line.length || line[index] != null) return null;
  const empties: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] == null) empties.push(i);
  }
  if (empties.length !== 1 || empties[0] !== index) return null;
  const completed = lines.filter((done) => isLineComplete(done));
  const options: Digit[] = [];
  for (const digit of [0, 1] as const) {
    const candidate = line.slice();
    candidate[index] = digit;
    if (!completed.some((done) => lineEquals(done, candidate))) options.push(digit);
  }
  return options.length === 1 ? options[0] : null;
}

export function techniqueLabel(rule: RuleId): string {
  if (rule === "unique") return "uniqueness";
  return rule;
}
