import { describe, expect, it } from "vitest";
import { dailySeed, dailyShareLine, formatElapsed } from "./daily";

describe("daily board", () => {
  it("derives a stable seed from the local day", () => {
    expect(dailySeed("2026-11-20")).toBe(102300637);
    expect(dailySeed("2026-11-20")).toBe(dailySeed("2026-11-20"));
    expect(dailySeed("2026-11-21")).toBe(85523018);
    expect(dailySeed("2026-11-21")).not.toBe(dailySeed("2026-11-20"));
  });

  it("formats the clock without a date", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(90000)).toBe("1:30");
    expect(formatElapsed(125000)).toBe("2:05");
    expect(formatElapsed(3661000)).toBe("1:01:01");
  });

  it("shares time, hints, and a clean flag, and not the board", () => {
    const clean = dailyShareLine({ day: "2026-11-20", elapsedMs: 125000, hintsUsed: 0, clean: true });
    const hinted = dailyShareLine({ day: "2026-11-20", elapsedMs: 9000, hintsUsed: 1, clean: true });
    const missed = dailyShareLine({ day: "2026-11-20", elapsedMs: 125000, hintsUsed: 2, clean: false });
    expect(clean).toBe("Binairo 2026-11-20 · 2:05 · 0 hints · clean");
    expect(hinted).toBe("Binairo 2026-11-20 · 0:09 · 1 hint · clean");
    expect(missed).toBe("Binairo 2026-11-20 · 2:05 · 2 hints · not clean");
    for (const line of [clean, hinted, missed]) {
      expect(line.includes("\n")).toBe(false);
      expect(line).not.toMatch(/[01]{3,}/);
      expect(line.includes("110100")).toBe(false);
    }
  });
});
