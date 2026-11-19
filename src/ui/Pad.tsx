import { Pressable, StyleSheet, Text, View } from "react-native";
import { hintCost } from "../domain/scoring";
import type { Digit, Tier } from "../domain/types";
import { pressable, sans, theme } from "./theme";

interface PadProps {
  selected: Digit | "erase";
  tier: Tier;
  canUndo: boolean;
  canHint: boolean;
  canReset: boolean;
  primaryLabel: string | null;
  primaryDisabled?: boolean;
  onSelect: (tool: Digit | "erase") => void;
  onUndo: () => void;
  onHint: () => void;
  onReset: () => void;
  onPrimary: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  busy: boolean;
}

export function Pad({
  selected,
  tier,
  canUndo,
  canHint,
  canReset,
  primaryLabel,
  primaryDisabled,
  onSelect,
  onUndo,
  onHint,
  onReset,
  onPrimary,
  onZoomIn,
  onZoomOut,
  busy,
}: PadProps) {
  const cost = hintCost(tier);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <DigitButton digit={0} selected={selected === 0} onPress={() => onSelect(0)} />
        <DigitButton digit={1} selected={selected === 1} onPress={() => onSelect(1)} />
        <ToolButton label="Erase" selected={selected === "erase"} onPress={() => onSelect("erase")} />
      </View>
      <View style={styles.row}>
        <ToolButton label="Undo" disabled={!canUndo || busy} onPress={onUndo} />
        <ToolButton label={cost === 0 ? "Hint" : `Hint · ${cost}`} disabled={!canHint || busy} onPress={onHint} />
        <ToolButton label="Reset" disabled={!canReset || busy} onPress={onReset} />
      </View>
      <View style={styles.row}>
        {primaryLabel ? (
          <ToolButton
            label={busy ? "Building a board…" : primaryLabel}
            disabled={busy || primaryDisabled}
            onPress={onPrimary}
            grow
          />
        ) : null}
        <ToolButton label="−" onPress={onZoomOut} />
        <ToolButton label="+" onPress={onZoomIn} />
      </View>
    </View>
  );
}

function DigitButton({ digit, selected, onPress }: { digit: Digit; selected: boolean; onPress: () => void }) {
  const background = digit === 0 ? theme.zero : theme.one;
  const color = digit === 0 ? theme.zeroInk : theme.oneInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={digit === 0 ? "Write 0" : "Write 1"}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.digit, pressable, { backgroundColor: background, borderColor: selected ? theme.gold : background }]}
    >
      <Text style={[styles.digitText, { color }]}>{digit}</Text>
    </Pressable>
  );
}

function ToolButton({
  label,
  onPress,
  disabled,
  selected,
  grow,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  grow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tool,
        pressable,
        grow ? { flex: 1 } : null,
        selected ? styles.toolOn : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.toolText, selected ? styles.toolTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  digit: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  digitText: {
    fontFamily: sans,
    fontSize: 26,
    fontWeight: "700",
  },
  tool: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  toolOn: {
    borderColor: theme.ink,
    backgroundColor: theme.ink,
  },
  toolText: {
    fontFamily: sans,
    color: theme.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  toolTextOn: {
    color: theme.coachText,
  },
  disabled: {
    opacity: 0.45,
  },
});
