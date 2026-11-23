import { Pressable, StyleSheet, Text, View } from "react-native";
import { lessonCount, sizeLabel, tierLabel } from "../domain/campaign";
import { dailyShareLine } from "../domain/daily";
import { hintCost } from "../domain/scoring";
import { attemptStatus, blankStars, movePar } from "../domain/stars";
import type { BoardSlot, GameState } from "../game/types";
import { pressable, radius, sans, serif, space, theme, type } from "./theme";
import { StarReadout } from "./Stars";

interface CoachProps {
  state: GameState;
  slot: BoardSlot;
  elapsedLabel: string;
  shareNote: string | null;
  onMode: (mode: "campaign" | "practice") => void;
  onBack: () => void;
  onShare: (line: string) => void;
}

export function Coach({ state, slot, elapsedLabel, shareNote, onMode, onBack, onShare }: CoachProps) {
  const { puzzle } = slot;
  const daily = state.surface === "daily" && state.daily ? state.daily : null;
  const where = daily
    ? `Today · ${sizeLabel(puzzle.shape, puzzle.size)}${daily.won ? "" : ` · ${elapsedLabel}`}`
    : state.mode === "campaign"
      ? `Lesson ${state.campaignIndex + 1} of ${lessonCount()} · ${sizeLabel(puzzle.shape, puzzle.size)}`
      : `Practice · ${sizeLabel(puzzle.shape, puzzle.size)}`;
  const cost = hintCost(puzzle.tier);
  const event = daily ? daily.coachLine : state.coachLine;
  const shareLine = daily?.won
    ? dailyShareLine({
        day: daily.day,
        elapsedMs: daily.elapsedMs,
        hintsUsed: daily.hintsUsed,
        clean: daily.clean,
      })
    : null;
  const lessonStars = !daily && state.mode === "campaign";
  const record = state.stars[puzzle.id] ?? blankStars();
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Binairo</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={pressable}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
      </View>
      {daily ? null : (
        <View style={styles.modes}>
          <ModeButton label="Campaign" active={state.mode === "campaign"} onPress={() => onMode("campaign")} />
          <ModeButton label="Practice" active={state.mode === "practice"} onPress={() => onMode("practice")} />
        </View>
      )}
      <Text style={styles.kicker}>{daily ? "Daily" : tierLabel(puzzle.tier)}</Text>
      <Text style={styles.where}>{where}</Text>
      <Text style={styles.teach}>{puzzle.teach}</Text>
      {lessonStars ? (
        <View>
          <StarReadout stars={record} />
          {slot.won ? null : (
            <Text style={styles.attempt}>
              {attemptStatus({
                par: movePar(puzzle.givens),
                moves: slot.moves,
                hintsUsed: slot.hintsUsed,
                clean: slot.clean,
              })}
            </Text>
          )}
        </View>
      ) : null}
      {event ? (
        <Text
          style={[
            styles.event,
            event.startsWith("no-triple:") ||
            event.startsWith("balance:") ||
            event.startsWith("unique:") ||
            event.startsWith("A hint costs")
              ? styles.danger
              : event.startsWith("Solved") || event.includes("Solved.")
                ? styles.good
                : null,
          ]}
        >
          {event}
        </Text>
      ) : null}
      {shareLine ? (
        <View style={styles.shareBlock}>
          <Text selectable style={styles.shareLine}>
            {shareLine}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share today's result"
            onPress={() => onShare(shareLine)}
            style={pressable}
          >
            <Text style={styles.shareButton}>Share</Text>
          </Pressable>
          {shareNote ? <Text style={styles.shareNote}>{shareNote}</Text> : null}
        </View>
      ) : null}
      <View style={styles.stats}>
        <Stat label="Points" value={String(state.points)} />
        <Stat label="Puzzle streak" value={String(state.puzzleStreak)} />
        <Stat label="Daily streak" value={String(state.dailyStreak)} />
      </View>
      <Text style={styles.cost}>
        {daily
          ? "Hints are free on the daily board."
          : cost === 0
            ? "Hints are free on this tier."
            : `A hint costs ${cost} points. Costs are provisional.`}
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
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    fontFamily: sans,
    color: theme.accentOnDark,
    fontSize: type.caption,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  back: {
    fontFamily: sans,
    color: theme.accentOnDark,
    fontSize: type.body,
    fontWeight: "700",
    minHeight: 44,
    lineHeight: 44,
  },
  modes: {
    flexDirection: "row",
    gap: space.lg,
  },
  mode: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: type.small,
    fontWeight: "600",
    minHeight: 44,
    lineHeight: 44,
  },
  modeOn: {
    color: theme.accentOnDark,
  },
  kicker: {
    fontFamily: serif,
    color: theme.coachText,
    fontSize: type.display,
    marginTop: space.xs,
  },
  where: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: type.caption,
    letterSpacing: 0.3,
  },
  teach: {
    fontFamily: sans,
    color: theme.coachText,
    fontSize: type.body,
    lineHeight: 22,
    marginTop: space.xs,
  },
  attempt: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: type.caption,
    lineHeight: 16,
    marginTop: space.xs,
  },
  event: {
    fontFamily: sans,
    color: theme.coachText,
    fontSize: type.body,
    lineHeight: 22,
  },
  danger: {
    color: theme.danger,
  },
  good: {
    color: theme.good,
  },
  stats: {
    flexDirection: "row",
    gap: space.md,
    marginTop: space.sm,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontFamily: serif,
    color: theme.accentOnDark,
    fontSize: type.title,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: type.caption,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cost: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: type.caption,
    marginTop: space.xs,
  },
  shareBlock: {
    gap: space.xs,
    marginTop: space.xs,
  },
  shareLine: {
    fontFamily: sans,
    color: theme.coachText,
    fontSize: type.body,
    lineHeight: 22,
  },
  shareButton: {
    fontFamily: sans,
    color: theme.accentOnDark,
    fontSize: type.body,
    fontWeight: "700",
    minHeight: 44,
    lineHeight: 44,
  },
  shareNote: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: type.caption,
  },
});
