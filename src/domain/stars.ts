import { countHoles } from "./grid";
import type { Grid } from "./types";

/** One campaign lesson can keep each of these. A later finish never turns one off. */
export interface LessonStars {
  clean: boolean;
  par: boolean;
  hint: boolean;
}

export type LessonStarsMap = Record<string, LessonStars>;

export function blankStars(): LessonStars {
  return { clean: false, par: false, hint: false };
}

/** Par is one move per empty cell. A perfect fill uses exactly that many. */
export function movePar(givens: Grid): number {
  return countHoles(givens);
}

export function starsForAttempt(attempt: {
  clean: boolean;
  moves: number;
  hintsUsed: number;
  par: number;
}): LessonStars {
  return {
    clean: attempt.clean,
    par: attempt.moves <= attempt.par,
    hint: attempt.hintsUsed === 0,
  };
}

/** Keeps every star already earned, then adds any the new finish earned. */
export function mergeStars(kept: LessonStars | undefined, earned: LessonStars): LessonStars {
  return {
    clean: Boolean(kept?.clean) || earned.clean,
    par: Boolean(kept?.par) || earned.par,
    hint: Boolean(kept?.hint) || earned.hint,
  };
}

export function starCount(stars: LessonStars | undefined): number {
  const value = stars ?? blankStars();
  return Number(value.clean) + Number(value.par) + Number(value.hint);
}

export function starSummary(stars: LessonStars | undefined): string {
  const value = stars ?? blankStars();
  const count = starCount(value);
  const noun = count === 1 ? "1 star" : `${count} stars`;
  const earned = [value.clean ? "clean" : null, value.par ? "par" : null, value.hint ? "no hint" : null].filter(
    (part): part is string => part != null,
  );
  if (earned.length === 0) return noun;
  return `${noun}: ${earned.join(", ")}`;
}

export function attemptStatus(attempt: { par: number; moves: number; hintsUsed: number; clean: boolean }): string {
  const moves = attempt.moves === 1 ? "1 move" : `${attempt.moves} moves`;
  const hints = attempt.hintsUsed === 0 ? "No hint yet" : attempt.hintsUsed === 1 ? "1 hint" : `${attempt.hintsUsed} hints`;
  const clean = attempt.clean ? "Clean so far" : "Not clean";
  return `Par ${attempt.par}. ${moves}. ${hints}. ${clean}.`;
}

export function cloneStars(stars: LessonStarsMap): LessonStarsMap {
  const copy: LessonStarsMap = {};
  for (const [id, value] of Object.entries(stars)) {
    copy[id] = { ...value };
  }
  return copy;
}
