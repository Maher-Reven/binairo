import { describe, expect, it } from "vitest";
import { attemptStatus, mergeStars, movePar, starSummary, starsForAttempt } from "./stars";

describe("lesson stars", () => {
  it("uses one move of par for each empty cell", () => {
    expect(movePar([[1, null, null, 0]])).toBe(2);
    expect(movePar([[1, 0]])).toBe(0);
  });

  it("earns clean, par, and no hint separately", () => {
    expect(starsForAttempt({ clean: true, moves: 2, hintsUsed: 0, par: 2 })).toEqual({
      clean: true,
      par: true,
      hint: true,
    });
    expect(starsForAttempt({ clean: false, moves: 2, hintsUsed: 0, par: 2 }).clean).toBe(false);
    expect(starsForAttempt({ clean: true, moves: 3, hintsUsed: 0, par: 2 }).par).toBe(false);
    expect(starsForAttempt({ clean: true, moves: 2, hintsUsed: 1, par: 2 }).hint).toBe(false);
    expect(starsForAttempt({ clean: true, moves: 2, hintsUsed: 0, par: 2 }).par).toBe(true);
  });

  it("adds a missing star and keeps one already earned", () => {
    const kept = mergeStars(undefined, { clean: false, par: true, hint: true });
    const replay = mergeStars(kept, { clean: true, par: false, hint: false });
    expect(replay).toEqual({ clean: true, par: true, hint: true });
    expect(starSummary(replay)).toBe("3 stars: clean, par, no hint");
    expect(starSummary(undefined)).toBe("0 stars");
    expect(starSummary({ clean: false, par: true, hint: false })).toBe("1 star: par");
  });

  it("describes the attempt without the board", () => {
    expect(attemptStatus({ par: 4, moves: 1, hintsUsed: 0, clean: true })).toBe(
      "Par 4. 1 move. No hint yet. Clean so far.",
    );
    expect(attemptStatus({ par: 4, moves: 5, hintsUsed: 2, clean: false })).toBe(
      "Par 4. 5 moves. 2 hints. Not clean.",
    );
  });
});
