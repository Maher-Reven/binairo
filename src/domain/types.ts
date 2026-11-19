/** 0 and 1 are the only digits. An empty cell is null. */
export type Digit = 0 | 1;

export type Cell = Digit | null;

/** Row-major grid. A lesson line is a single row. */
export type Grid = Cell[][];

export type RuleId = "no-triple" | "balance" | "unique";

export type Tier = "junior" | "medium" | "intermediate" | "advanced";

export type BoardShape = "line" | "grid";

export interface Rejection {
  rule: RuleId;
  /** One line. Names the rule it broke. */
  message: string;
}

export interface Force {
  row: number;
  col: number;
  digit: Digit;
  technique: RuleId;
}

export interface PuzzleSpec {
  id: string;
  tier: Tier;
  shape: BoardShape;
  size: number;
  rules: readonly RuleId[];
  seed: number;
  /** Prefer at least this many blanks. The generator keeps a thinner board if it must. */
  minHoles?: number;
}

export interface GeneratedPuzzle extends PuzzleSpec {
  givens: Grid;
  solution: Grid;
  /** Techniques the solver actually used. Guessing is never one of them. */
  techniquesRequired: RuleId[];
}
