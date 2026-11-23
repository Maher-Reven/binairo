import { describe, expect, it } from "vitest";
import { contrast, palette } from "./palette";

describe("palette contrast", () => {
  it("keeps text at WCAG AA and large marks at 3:1", () => {
    const text: Array<[string, string, number]> = [
      [palette.ink, palette.paper, 4.5],
      [palette.ink, palette.white, 4.5],
      [palette.inkSoft, palette.paper, 4.5],
      [palette.inkSoft, palette.white, 4.5],
      [palette.gold, palette.paper, 4.5],
      [palette.gold, palette.white, 4.5],
      [palette.coachText, palette.coach, 4.5],
      [palette.coachMuted, palette.coach, 4.5],
      [palette.accentOnDark, palette.coach, 4.5],
      [palette.danger, palette.coach, 4.5],
      [palette.good, palette.coach, 4.5],
      [palette.zeroInk, palette.zero, 4.5],
      [palette.oneInk, palette.one, 4.5],
      [palette.one, palette.paper, 4.5],
    ];
    for (const [foreground, background, minimum] of text) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
    }
    expect(contrast(palette.gold, palette.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.look, palette.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.crossEdge, palette.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.zero, palette.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.one, palette.paper)).toBeGreaterThanOrEqual(3);
    expect(palette.cross).not.toBe(palette.lookWash);
    expect(palette.crossActive).not.toBe(palette.lookWash);
    expect(palette.crossEdge).not.toBe(palette.gold);
    expect(palette.crossEdge).not.toBe(palette.look);
  });
});