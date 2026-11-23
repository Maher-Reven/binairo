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
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const marked =
    active != null && active.row >= 0 && active.col >= 0 && active.row < rows && active.col < cols ? active : null;
  return (
    <View style={{ gap }} accessibilityRole="none">
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap }}>
          {row.map((cell, c) => {
            const given = givens[r][c] != null;
            const ink = cell === 0 ? theme.zero : theme.one;
            const glyphColor = cell === 0 ? theme.zeroInk : theme.oneInk;
            const onRow = marked != null && r === marked.row;
            const onCol = marked != null && c === marked.col;
            const onCell = onRow && onCol;
            const onLine = onRow || onCol;
            const onLook =
              look != null &&
              ((look.axis === "row" && r === look.index) || (look.axis === "column" && c === look.index));
            const label = `Row ${r + 1}, column ${c + 1}, ${cell == null ? "empty" : cell}${given ? ", given" : ""}${onCell ? ", active" : onLine ? ", highlighted" : ""}${onLook ? ", hint look" : ""}`;
            const edge = onCell ? 3 : 2;
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
                    borderTopWidth: onRow ? edge : onLook ? 4 : 1,
                    borderBottomWidth: onRow ? edge : onLook ? 4 : 1,
                    borderLeftWidth: onCol ? edge : onLook ? 4 : 1,
                    borderRightWidth: onCol ? edge : onLook ? 4 : 1,
                    borderTopColor: onRow ? theme.crossEdge : onLook ? theme.look : theme.line,
                    borderBottomColor: onRow ? theme.crossEdge : onLook ? theme.look : theme.line,
                    borderLeftColor: onCol ? theme.crossEdge : onLook ? theme.look : theme.line,
                    borderRightColor: onCol ? theme.crossEdge : onLook ? theme.look : theme.line,
                    backgroundColor:
                      cell == null
                        ? onLook
                          ? theme.lookWash
                          : onCell
                            ? theme.crossActive
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
                {onLook ? (
                  <View pointerEvents="none" style={styles.marks}>
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
