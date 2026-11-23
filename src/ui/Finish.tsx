import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LessonStars } from "../domain/stars";
import { pressable, radius, sans, serif, space, theme, type } from "./theme";

interface FinishProps {
  timeLabel: string;
  moves: number;
  par: number;
  stars: LessonStars | null;
  earnedPoints: number;
  points: number;
  puzzleStreak: number;
  dailyStreak: number;
  primaryLabel: string;
  busy: boolean;
  onPrimary: () => void;
  onBack: () => void;
}

export function Finish({
  timeLabel,
  moves,
  par,
  stars,
  earnedPoints,
  points,
  puzzleStreak,
  dailyStreak,
  primaryLabel,
  busy,
  onPrimary,
  onBack,
}: FinishProps) {
  const moveLine = `${moves === 1 ? "1 move" : `${moves} moves`}. Par is ${par}.`;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Finished</Text>
      <Text style={styles.line}>Time {timeLabel}</Text>
      <Text style={styles.line}>{moveLine}</Text>
      {stars ? (
        <View style={styles.stars}>
          <StarLine earned={stars.clean} label="Clean finish" />
          <StarLine earned={stars.par} label="At or under par" />
          <StarLine earned={stars.hint} label="No hint" />
        </View>
      ) : null}
      <Text style={styles.line}>
        Points gained {earnedPoints}. Total {points}.
      </Text>
      <Text style={styles.line}>Puzzle streak {puzzleStreak}.</Text>
      <Text style={styles.line}>Daily streak {dailyStreak}.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        disabled={busy}
        onPress={onPrimary}
        style={[styles.primary, pressable, busy ? styles.dim : null]}
      >
        <Text style={styles.primaryText}>{busy ? "Building a board…" : primaryLabel}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={busy} onPress={onBack} style={[styles.backHit, pressable]}>
        <Text style={[styles.back, busy ? styles.dim : null]}>Back</Text>
      </Pressable>
    </View>
  );
}

function StarLine({ earned, label }: { earned: boolean; label: string }) {
  return (
    <Text accessibilityLabel={earned ? `${label}, earned` : `${label}, not earned`} style={[styles.star, earned ? styles.starOn : null]}>
      {earned ? "Earned" : "Not earned"} · {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.sm,
  },
  title: {
    fontFamily: serif,
    color: theme.ink,
    fontSize: type.display,
  },
  line: {
    fontFamily: sans,
    color: theme.ink,
    fontSize: type.body,
    lineHeight: 22,
  },
  stars: {
    gap: space.xs,
    marginVertical: space.xs,
  },
  star: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: type.body,
    lineHeight: 22,
  },
  starOn: {
    color: theme.ink,
    fontWeight: "700",
  },
  primary: {
    marginTop: space.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: theme.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  primaryText: {
    fontFamily: sans,
    color: theme.coachText,
    fontSize: type.body,
    fontWeight: "700",
  },
  backHit: {
    minHeight: 44,
    justifyContent: "center",
  },
  back: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: type.body,
    fontWeight: "700",
    textAlign: "center",
    minHeight: 44,
    lineHeight: 44,
  },
  dim: {
    opacity: 0.45,
  },
});
