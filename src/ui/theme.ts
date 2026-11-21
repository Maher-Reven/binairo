import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const theme = {
  paper: "#f3ecdf",
  paperDeep: "#e6d9c4",
  ink: "#241c16",
  inkSoft: "#5e534a",
  line: "#d5c4ae",
  gold: "#c9852a",
  zero: "#1f6a4e",
  zeroInk: "#f4fff9",
  one: "#a33b24",
  oneInk: "#fff7f3",
  coach: "#241c16",
  coachText: "#f6f0e6",
  coachMuted: "#d9cbb8",
  danger: "#ffb4a2",
  good: "#b7e0c7",
  white: "#fffdf8",
  /** Empty cells on the active row or column. Filled cells keep their digit color. */
  cross: "#f0d2a4",
  crossActive: "#e4b86a",
};

export const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  web: "Georgia, 'Iowan Old Style', Palatino, 'Palatino Linotype', serif",
  default: "serif",
});

export const sans = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif",
  web: "Avenir Next, 'Gill Sans', 'Trebuchet MS', sans-serif",
  default: "sans-serif",
});

export const MIN_CELL = 32;
export const MAX_CELL = 76;

export function baseCell(shape: "line" | "grid", size: number, pane = 800): number {
  if (shape === "line") {
    const fit = Math.floor((pane - 32 - (size - 1) * 4) / size);
    return clampCell(Math.min(64, fit));
  }
  if (size <= 4) return 64;
  if (size <= 6) return 52;
  if (size <= 10) return 42;
  return MIN_CELL;
}

export function clampCell(size: number): number {
  return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.round(size)));
}

export const pressable: ViewStyle = Platform.OS === "web" ? ({ cursor: "pointer" } as ViewStyle) : {};

export const titleType: TextStyle = {
  fontFamily: serif,
  color: theme.coachText,
  fontSize: 28,
  letterSpacing: 0.4,
};
