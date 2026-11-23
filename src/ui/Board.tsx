import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HintLook } from "../domain/techniques";
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
  /** The free hint look. One row or one column, with no digit revealed. */
  look: HintLook | null;
  onTap: (row: number, col: number) => void;
}

export function Board({ grid, givens, cellSize, disabled, active, look, onTap }: BoardProps) {
  const gap = cellSize >= 48 ? 8 : 4;
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
            const onLook =
              look != null &&
              ((look.axis === "row" && r === look.index) || (look.axis === "column" && c === look.index));
            const label = `Row ${r + 1}, column ${c + 1}, ${cell == null ? "empty" : cell}${given ? ", given" : ""}${onCell ? ", active" : onLine ? ", highlighted" : ""}${onLook ? ", hint look" : ""}`;
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
                    borderColor: onCell ? theme.ink : onLine ? theme.gold : onLook ? theme.look : theme.line,
                    borderWidth: onLine || onLook ? 4 : 1,
                    backgroundColor:
                      cell == null
                        ? onCell
                          ? theme.crossActive
                          : onLook
                            ? theme.lookWash
                            : onLine
                              ? theme.cross
                              : theme.white
                        : given
                          ? ink
                          : theme.paperDeep,
                    padding: cell != null && !given ? Math.max(3, Math.round(cellSize * 0.08)) : 0,
                  },
                ]}
              >
                <View style={[styles.glyphBox, cell != null && !given ? { backgroundColor: ink, borderRadius: 4 } : null]}>
                  {cell != null ? (
                    <Text style={{ color: glyphColor, fontSize: glyph, fontWeight: "700" }}>{cell}</Text>
                  ) : null}
                </View>
                {onLine || onLook ? (
                  <View pointerEvents="none" style={styles.marks}>
                    {onLine && r === marked.row ? <View style={styles.rowBar} /> : null}
                    {onLine && c === marked.col ? <View style={styles.colBar} /> : null}
                    {look?.axis === "row" && r === look.index ? <View style={styles.lookRow} /> : null}
                    {look?.axis === "column" && c === look.index ? <View style={styles.lookCol} /> : null}
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
  lookRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    backgroundColor: theme.look,
  },
  lookCol: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 4,
    backgroundColor: theme.look,
  },
});
