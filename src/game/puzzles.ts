import { firstLessonIndex, lessonAt, lessonCount } from "../domain/campaign";
import { DAILY_RULES, DAILY_SIZE, dailySeed } from "../domain/daily";
import { generatePuzzle } from "../domain/generator";
import type { Lesson } from "../domain/campaign";
import type { BoardShape, RuleId, Tier } from "../domain/types";
import type { PuzzleView } from "./types";

function viewFromLesson(lesson: Lesson, seed: number, id: string, teach: string): PuzzleView {
  const generated = generatePuzzle({
    id,
    tier: lesson.tier,
    shape: lesson.shape,
    size: lesson.size,
    rules: lesson.rules,
    seed,
  });
  return {
    id,
    tier: lesson.tier,
    shape: lesson.shape,
    size: lesson.size,
    rules: [...lesson.rules],
    seed,
    teach,
    givens: generated.givens,
  };
}

export function campaignPuzzle(index: number): PuzzleView {
  const lesson = lessonAt(index);
  return viewFromLesson(lesson, lesson.seed, lesson.id, lesson.teach);
}

export function practicePuzzle(campaignIndex: number, seed: number): PuzzleView {
  const lesson = lessonAt(campaignIndex);
  return viewFromLesson(lesson, seed >>> 0, `practice-${seed >>> 0}`, `Practice. ${lesson.teach}`);
}

/** Practice at an explicit size. Used when a tier has no campaign lesson. */
export function practicePuzzleAt(
  tier: Tier,
  shape: BoardShape,
  size: number,
  rules: readonly RuleId[],
  seed: number,
): PuzzleView {
  const safeSeed = seed >>> 0;
  const lesson: Lesson = {
    id: `practice-${tier}`,
    tier,
    shape,
    size,
    rules,
    seed: safeSeed,
    teach: "Practice. All three rules together: no three in a line, an even split, and no repeated row or column.",
  };
  return viewFromLesson(lesson, safeSeed, `practice-${safeSeed}`, lesson.teach);
}

/**
 * A new practice board follows the campaign lesson. When the board in hand
 * belongs to a tier with no lesson, the next board keeps that size.
 */
export function newPracticePuzzle(campaignIndex: number, active: PuzzleView, seed: number): PuzzleView {
  if (firstLessonIndex(active.tier) == null) {
    return practicePuzzleAt(active.tier, active.shape, active.size, active.rules, seed);
  }
  return practicePuzzle(campaignIndex, seed);
}

export function hasNextLesson(campaignIndex: number): boolean {
  return campaignIndex < lessonCount() - 1;
}

/**
 * Today's shared board. `tier` is junior only so a hint stays free.
 * The screen calls this Daily, not Junior.
 */
export function dailyPuzzle(day: string): PuzzleView {
  const seed = dailySeed(day);
  const teach = "Today's board. All three rules: no three in a line, an even split, and no repeated row or column.";
  const lesson: Lesson = {
    id: `daily-${day}`,
    tier: "junior",
    shape: "grid",
    size: DAILY_SIZE,
    rules: DAILY_RULES,
    seed,
    teach,
  };
  return viewFromLesson(lesson, seed, `daily-${day}`, teach);
}
