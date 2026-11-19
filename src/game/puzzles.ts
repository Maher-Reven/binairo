import { lessonAt, lessonCount } from "../domain/campaign";
import { generatePuzzle } from "../domain/generator";
import type { Lesson } from "../domain/campaign";
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

export function hasNextLesson(campaignIndex: number): boolean {
  return campaignIndex < lessonCount() - 1;
}
