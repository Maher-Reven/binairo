import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Grid } from "../domain/types";
import { pressable, theme } from "./theme";

interface ActiveCell {
  row: number;
  col: number;
}

interface BoardProps {
  grid: Grid;
  givens: Grid;
  cellSize: number;
  disabled: boolean;
  /** The cell the player last touched. Its row and column stay marked. */
  active: ActiveCell | null;
  onTap: (row: number, col: number) => void;
}

export function Board({ grid, givens, cellSize, disabled, active, onTap }: BoardProps) {
  const gap = cellSize >= 48 ? 6 : 4;
  const glyph = Math.max(16, Math.round(cellSize * 0.48));
  const marked =
    active != null && active.row >= 0 && active.col >= 0 && active.row < grid.length && active.col < grid[0].length
      ? active
      : null;
  return (
    <View style={{ gap }} accessibilityRole="none">
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap }}>
          {row.map((cell, c) => {
            const given = givens[r][c] != null;
            const ink = cell === 0 ? theme.zero : theme.one;
            const glyphColor = cell === 0 ? theme.zeroInk : theme.oneInk;
            const onCell = marked != null && r === marked.row && c === marked.col;
            const onLine = marked != null && (r === marked.row || c === marked.col);
            const label = `Row ${r + 1}, column ${c + 1}, ${cell == null ? "empty" : cell}${given ? ", given" : ""}${onCell ? ", active" : onLine ? ", highlighted" : ""}`;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: onCell }}
                disabled={disabled}
                onPress={() => onTap(r, c)}
                style={[
                  styles.cell,
                  pressable,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderRadius: Math.max(6, Math.round(cellSize * 0.16)),
                    borderColor: onCell ? theme.ink : onLine ? theme.gold : theme.line,
                    borderWidth: onLine ? 4 : 1,
                    backgroundColor:
                      cell == null ? (onCell ? theme.crossActive : onLine ? theme.cross : theme.white) : given ? ink : theme.paperDeep,
                    padding: cell != null && !given ? Math.max(3, Math.round(cellSize * 0.08)) : 0,
                  },
                ]}
              >
                <View style={[styles.glyphBox, cell != null && !given ? { backgroundColor: ink, borderRadius: 4 } : null]}>
                  {cell != null ? (
                    <Text style={{ color: glyphColor, fontSize: glyph, fontWeight: "700" }}>{cell}</Text>
                  ) : null}
                </View>
                {onLine ? (
                  <View pointerEvents="none" style={styles.marks}>
                    {r === marked.row ? <View style={styles.rowBar} /> : null}
                    {c === marked.col ? <View style={styles.colBar} /> : null}
                  </View>
                ) : null}
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
  marks: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  rowBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: theme.gold,
  },
  colBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: theme.gold,
  },
});
