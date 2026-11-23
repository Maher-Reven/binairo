/**
 * One warm palette for the picker, the board, the coach, and the finish screen.
 * Text pairs are aimed at WCAG AA (4.5:1). Large marks aim at 3:1.
 */
export const palette = {
  paper: "#F4F0E8",
  paperDeep: "#E7E1D6",
  white: "#FFFCF8",
  ink: "#1C1916",
  inkSoft: "#5C534C",
  line: "#E0D8CC",
  /** Accent on paper and on cards. Stars, wordmark, active-line marks. */
  gold: "#8A5520",
  /** The same accent, light enough to read on the dark coach. */
  accentOnDark: "#E6C08A",
  zero: "#145C42",
  zeroInk: "#F4FFF8",
  one: "#9A3412",
  oneInk: "#FFF7F4",
  coach: "#1C1916",
  coachText: "#F6F1E8",
  coachMuted: "#D2C4B4",
  danger: "#FFD2C8",
  good: "#C9E6D4",
  /** Quiet wash on the active row and column. Digits keep their own color. */
  cross: "#EFE6D6",
  crossActive: "#E7D3B0",
  /** Hint look, a slate in the same family, distinct from the warm active line. */
  look: "#2F5D73",
  lookWash: "#D0E2EC",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const type = {
  caption: 12,
  small: 14,
  body: 16,
  title: 22,
  display: 28,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
} as const;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function contrast(foreground: string, background: string): number {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = channel((n >> 16) & 255);
    const g = channel((n >> 8) & 255);
    const b = channel(n & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(foreground);
  const b = lum(background);
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}
