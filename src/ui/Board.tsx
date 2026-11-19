import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Grid } from "../domain/types";
import { pressable, theme } from "./theme";

interface BoardProps {
  grid: Grid;
  givens: Grid;
  cellSize: number;
  disabled: boolean;
  onTap: (row: number, col: number) => void;
}

export function Board({ grid, givens, cellSize, disabled, onTap }: BoardProps) {
  const gap = cellSize >= 48 ? 6 : 4;
  const glyph = Math.max(16, Math.round(cellSize * 0.48));
  return (
    <View style={{ gap }} accessibilityRole="none">
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap }}>
          {row.map((cell, c) => {
            const given = givens[r][c] != null;
            const ink = cell === 0 ? theme.zero : theme.one;
            const glyphColor = cell === 0 ? theme.zeroInk : theme.oneInk;
            const label = `Row ${r + 1}, column ${c + 1}, ${cell == null ? "empty" : cell}${given ? ", given" : ""}`;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={disabled}
                onPress={() => onTap(r, c)}
                style={[
                  styles.cell,
                  pressable,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderRadius: Math.max(6, Math.round(cellSize * 0.16)),
                    backgroundColor: cell == null ? theme.white : given ? ink : theme.paperDeep,
                    padding: cell != null && !given ? Math.max(3, Math.round(cellSize * 0.08)) : 0,
                  },
                ]}
              >
                <View style={[styles.glyphBox, cell != null && !given ? { backgroundColor: ink, borderRadius: 4 } : null]}>
                  {cell != null ? (
                    <Text style={{ color: glyphColor, fontSize: glyph, fontWeight: "700" }}>{cell}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.line,
  },
  glyphBox: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
