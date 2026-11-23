import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { palette, radius, space, type } from "./palette";

export const theme = palette;
export { radius, space, type };

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
  color: theme.ink,
  fontSize: type.display,
  letterSpacing: 0.2,
};
