import type { BoardShape, RuleId, Tier } from "./types";

export interface Lesson {
  id: string;
  tier: Tier;
  shape: BoardShape;
  size: number;
  rules: readonly RuleId[];
  /** Fixed seed: the lesson is the same board every time. */
  seed: number;
  /** The rule this lesson exists to teach. */
  teach: string;
}

const ALL: readonly RuleId[] = ["no-triple", "balance", "unique"];

const LATER = "All three rules together: no three in a line, an even split, and no repeated row or column.";

/**
 * Campaign order: no-triple on a line, no-triple on 4×4, no-triple plus balance
 * on 4×4, all three rules on 6×6, then one board at each larger size.
 */
export const LESSONS: readonly Lesson[] = [
  {
    id: "line-no-triple",
    tier: "junior",
    shape: "line",
    size: 8,
    rules: ["no-triple"],
    seed: 101,
    teach: "No three identical digits in a row. A gap counts, so 1 _ 1 cannot become 1 1 1.",
  },
  {
    id: "grid4-no-triple",
    tier: "junior",
    shape: "grid",
    size: 4,
    rules: ["no-triple"],
    seed: 211,
    teach: "No-triple on a grid. The same rule runs across and down.",
  },
  {
    id: "grid4-balance",
    tier: "junior",
    shape: "grid",
    size: 4,
    rules: ["no-triple", "balance"],
    seed: 307,
    teach: "Balance: each row and each column is half 0s and half 1s.",
  },
  {
    id: "grid6-all",
    tier: "junior",
    shape: "grid",
    size: 6,
    rules: ALL,
    seed: 401,
    teach: "Unique: every row is different, and every column is different.",
  },
  { id: "grid8", tier: "medium", shape: "grid", size: 8, rules: ALL, seed: 503, teach: LATER },
  { id: "grid10", tier: "medium", shape: "grid", size: 10, rules: ALL, seed: 601, teach: LATER },
  { id: "grid12", tier: "intermediate", shape: "grid", size: 12, rules: ALL, seed: 701, teach: LATER },
  { id: "grid14", tier: "intermediate", shape: "grid", size: 14, rules: ALL, seed: 809, teach: LATER },
  { id: "grid16", tier: "intermediate", shape: "grid", size: 16, rules: ALL, seed: 907, teach: LATER },
  { id: "grid18", tier: "advanced", shape: "grid", size: 18, rules: ALL, seed: 1009, teach: LATER },
  { id: "grid20", tier: "advanced", shape: "grid", size: 20, rules: ALL, seed: 1103, teach: LATER },
  { id: "grid24", tier: "advanced", shape: "grid", size: 24, rules: ALL, seed: 1201, teach: LATER },
];

export function lessonCount(): number {
  return LESSONS.length;
}

export function lessonAt(index: number): Lesson {
  const clamped = Math.min(Math.max(index, 0), LESSONS.length - 1);
  return LESSONS[clamped];
}

export function tierLabel(tier: Tier): string {
  if (tier === "junior") return "Junior";
  if (tier === "medium") return "Medium";
  if (tier === "intermediate") return "Intermediate";
  return "Advanced";
}

export function sizeLabel(shape: BoardShape, size: number): string {
  return shape === "line" ? `line of ${size}` : `${size}×${size}`;
}
