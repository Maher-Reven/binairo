import { isCampaignLesson, LESSONS } from "../domain/campaign";
import { completionPoints } from "../domain/scoring";
import { movePar, starsForAttempt, type LessonStars } from "../domain/stars";
import { activeSlot } from "./reduce";
import type { GameState } from "./types";

/** What the finish screen's one primary button starts. The tier saves stay put. */
export type FinishNext =
  | { kind: "lesson"; campaignIndex: number }
  | { kind: "practice" }
  | { kind: "picker" };

export interface FinishSummary {
  moves: number;
  par: number;
  /** This finish only. Practice and the daily board leave it empty. */
  stars: LessonStars | null;
  earnedPoints: number;
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
}

/** The next campaign lesson in this tier, or null on the tier's last lesson. */
export function nextLessonInTier(campaignIndex: number): number | null {
  if (campaignIndex < 0 || campaignIndex >= LESSONS.length) return null;
  const next = campaignIndex + 1;
  if (next >= LESSONS.length || LESSONS[next].tier !== LESSONS[campaignIndex].tier) return null;
  return next;
}

export function finishSummary(state: GameState): FinishSummary | null {
  const slot = activeSlot(state);
  if (!slot.won) return null;
  const par = movePar(slot.puzzle.givens);
  const lesson = state.surface !== "daily" && state.mode === "campaign" && isCampaignLesson(slot.puzzle.id);
  return {
    moves: slot.moves,
    par,
    stars: lesson
      ? starsForAttempt({ clean: slot.clean, moves: slot.moves, hintsUsed: slot.hintsUsed, par })
      : null,
    earnedPoints: completionPoints(slot.puzzle.size, state.puzzleStreak),
    points: state.points,
    puzzleStreak: state.puzzleStreak,
    dailyStreak: state.dailyStreak,
  };
}

/**
 * Campaign with another lesson in the same tier opens that lesson.
 * The last lesson in a tier, and practice, deal another practice board of this tier.
 * The daily board returns to the tier picker.
 */
export function finishNext(state: GameState): FinishNext | null {
  const slot = activeSlot(state);
  if (!slot.won) return null;
  if (state.surface === "daily") return { kind: "picker" };
  if (state.mode === "campaign") {
    const next = nextLessonInTier(state.campaignIndex);
    if (next != null) return { kind: "lesson", campaignIndex: next };
  }
  return { kind: "practice" };
}

export function finishPrimaryLabel(next: FinishNext): string {
  if (next.kind === "lesson") return "Next lesson";
  if (next.kind === "practice") return "New board";
  return "Choose a tier";
}
