import { Pressable, StyleSheet, Text, View } from "react-native";
import { lessonCount, sizeLabel, tierLabel } from "../domain/campaign";
import { hintCost } from "../domain/scoring";
import type { GameState } from "../game/types";
import type { BoardSlot } from "../game/types";
import { pressable, sans, serif, theme } from "./theme";

interface CoachProps {
  state: GameState;
  slot: BoardSlot;
  onMode: (mode: "campaign" | "practice") => void;
}

export function Coach({ state, slot, onMode }: CoachProps) {
  const { puzzle } = slot;
  const where =
    state.mode === "campaign"
      ? `Lesson ${state.campaignIndex + 1} of ${lessonCount()} · ${sizeLabel(puzzle.shape, puzzle.size)}`
      : `Practice · ${sizeLabel(puzzle.shape, puzzle.size)}`;
  const cost = hintCost(puzzle.tier);
  return (
    <View style={styles.card}>
      <Text style={styles.wordmark}>Binairo</Text>
      <View style={styles.modes}>
        <ModeButton label="Campaign" active={state.mode === "campaign"} onPress={() => onMode("campaign")} />
        <ModeButton label="Practice" active={state.mode === "practice"} onPress={() => onMode("practice")} />
      </View>
      <Text style={styles.kicker}>{tierLabel(puzzle.tier)}</Text>
      <Text style={styles.where}>{where}</Text>
      <Text style={styles.teach}>{puzzle.teach}</Text>
      {state.coachLine ? (
        <Text
          style={[
            styles.event,
            state.coachLine.startsWith("no-triple") ||
            state.coachLine.startsWith("balance") ||
            state.coachLine.startsWith("unique") ||
            state.coachLine.startsWith("A hint costs")
              ? styles.danger
              : state.coachLine.startsWith("Solved") || state.coachLine.includes("Solved.")
                ? styles.good
                : null,
          ]}
        >
          {state.coachLine}
        </Text>
      ) : null}
      <View style={styles.stats}>
        <Stat label="Points" value={String(state.points)} />
        <Stat label="Puzzle streak" value={String(state.puzzleStreak)} />
        <Stat label="Daily streak" value={String(state.dailyStreak)} />
      </View>
      <Text style={styles.cost}>
        {cost === 0 ? "Hints are free on this tier." : `A hint costs ${cost} points. Costs are provisional.`}
      </Text>
    </View>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={pressable}>
      <Text style={[styles.mode, active ? styles.modeOn : null]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.coach,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 6,
  },
  wordmark: {
    fontFamily: sans,
    color: theme.gold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  modes: {
    flexDirection: "row",
    gap: 16,
  },
  mode: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  modeOn: {
    color: theme.gold,
  },
  kicker: {
    fontFamily: serif,
    color: theme.coachText,
    fontSize: 28,
    marginTop: 4,
  },
  where: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  teach: {
    fontFamily: sans,
    color: theme.coachText,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  event: {
    fontFamily: sans,
    color: theme.coachText,
    fontSize: 15,
    lineHeight: 21,
  },
  danger: {
    color: theme.danger,
  },
  good: {
    color: theme.good,
  },
  stats: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontFamily: serif,
    color: theme.gold,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cost: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
