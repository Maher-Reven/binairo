/**
 * The daily board is the same puzzle on every device for one local calendar day.
 * The seed is FNV-1a over the YYYY-MM-DD string. Math.imul keeps the 32-bit
 * multiply identical in the browser and in Hermes. There is no clock read here.
 */
export function dailySeed(day: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    hash = Math.imul(hash ^ day.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

/** 6×6 is the first size that uses every rule, and it stays quick to build. */
export const DAILY_SIZE = 6;

export const DAILY_RULES = ["no-triple", "balance", "unique"] as const;

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * One line a player can paste. Time, hints, and clean or not.
 * The board, the digits, and the solution stay out of it.
 */
export function dailyShareLine(result: {
  day: string;
  elapsedMs: number;
  hintsUsed: number;
  clean: boolean;
}): string {
  const hints = result.hintsUsed === 1 ? "1 hint" : `${result.hintsUsed} hints`;
  const clean = result.clean ? "clean" : "not clean";
  return `Binairo ${result.day} · ${formatElapsed(result.elapsedMs)} · ${hints} · ${clean}`;
}
