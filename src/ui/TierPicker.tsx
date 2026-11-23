import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { lessonsForTier, lessonStarName, TIER_ORDER, tierLabel, tierSizeLabel, tierStart } from "../domain/campaign";
import { dailyStreakLabel, hintCost } from "../domain/scoring";
import { blankStars, starSummary } from "../domain/stars";
import type { LessonStarsMap } from "../domain/stars";
import type { Tier } from "../domain/types";
import { pressable, radius, sans, serif, space, theme, type } from "./theme";

interface TierPickerProps {
  busy: boolean;
  error: string | null;
  continued: readonly Tier[];
  dailyStatus: "fresh" | "playing" | "won";
  dailyStreak: number;
  stars: LessonStarsMap;
  canBack: boolean;
  onPick: (tier: Tier) => void;
  onDaily: () => void;
  onBack: () => void;
}

export function TierPicker({
  busy,
  error,
  continued,
  dailyStatus,
  dailyStreak,
  stars,
  canBack,
  onPick,
  onDaily,
  onBack,
}: TierPickerProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, wide ? styles.contentWide : null]}
    >
      <Text style={styles.wordmark}>Binairo</Text>
      <Text style={styles.title}>Choose a tier</Text>
      <Text style={styles.lead}>Each tier keeps its board. The daily board is separate. Points and streaks stay with you.</Text>
      <View accessibilityRole="text" accessibilityLabel={dailyStreakLabel(dailyStreak)} style={styles.streak}>
        <Text style={styles.streakName}>Daily streak</Text>
        <Text style={styles.streakValue}>{Math.max(0, Math.floor(dailyStreak))}</Text>
      </View>
      <View style={styles.list}>
        <DailyCard status={dailyStatus} busy={busy} onDaily={onDaily} />
        {TIER_ORDER.map((tier) => (
          <TierCard
            key={tier}
            tier={tier}
            continued={continued.includes(tier)}
            busy={busy}
            stars={stars}
            onPick={onPick}
          />
        ))}
      </View>
      {busy ? <Text style={styles.status}>Building a board…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {canBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the board"
          disabled={busy}
          onPress={onBack}
          style={pressable}
        >
          <Text style={[styles.back, busy ? styles.dim : null]}>Back to the board</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function DailyCard({
  status,
  busy,
  onDaily,
}: {
  status: "fresh" | "playing" | "won";
  busy: boolean;
  onDaily: () => void;
}) {
  const detail = dailyDetail(status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Daily. ${detail}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onDaily}
      style={[styles.card, styles.daily, pressable, busy ? styles.dim : null]}
    >
      <Text style={styles.name}>Daily</Text>
      <Text style={styles.sizes}>Today's 6×6</Text>
      <Text style={styles.detail}>{detail}</Text>
    </Pressable>
  );
}

function dailyDetail(status: "fresh" | "playing" | "won"): string {
  if (status === "playing") return "Continues today's board. The same board on every device.";
  if (status === "won") return "Today's result is ready to share. The same board on every device.";
  return "The same board on every device. Hints are free.";
}

function TierCard({
  tier,
  continued,
  busy,
  stars,
  onPick,
}: {
  tier: Tier;
  continued: boolean;
  busy: boolean;
  stars: LessonStarsMap;
  onPick: (tier: Tier) => void;
}) {
  const detail = tierDetail(tier, continued);
  const lessons = lessonsForTier(tier);
  const lessonLabel = lessons
    .map((lesson) => `${lessonStarName(lesson)}, ${starSummary(stars[lesson.id])}`)
    .join(". ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tierLabel(tier)}. ${tierSizeLabel(tier)}. ${detail}. ${lessonLabel}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={() => onPick(tier)}
      style={[styles.card, pressable, busy ? styles.dim : null]}
    >
      <Text style={styles.name}>{tierLabel(tier)}</Text>
      <Text style={styles.sizes}>{tierSizeLabel(tier)}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <Text style={styles.starKey}>Clean, par, no hint</Text>
      {lessons.map((lesson) => {
        const record = stars[lesson.id] ?? blankStars();
        return (
          <Text key={lesson.id} style={styles.lessonLine}>
            {lessonStarName(lesson)}{" "}
            <Text style={record.clean ? styles.starOn : styles.starOff}>{record.clean ? "★" : "☆"}</Text>
            <Text style={record.par ? styles.starOn : styles.starOff}>{record.par ? "★" : "☆"}</Text>
            <Text style={record.hint ? styles.starOn : styles.starOff}>{record.hint ? "★" : "☆"}</Text>
          </Text>
        );
      })}
    </Pressable>
  );
}

function tierDetail(tier: Tier, continued: boolean): string {
  const start = tierStart(tier);
  const cost = hintCost(tier);
  const hint = cost === 0 ? "Hints are free." : `A hint costs ${cost} points.`;
  const rules = tier === "junior" ? "One new rule at a time." : "All three rules.";
  if (continued) return `Continues your board. ${rules} ${hint}`;
  const where =
    start.kind === "campaign" ? "Starts at the first lesson." : `Starts a ${start.size}×${start.size} practice board.`;
  return `${where} ${rules} ${hint}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.paper,
  },
  content: {
    flexGrow: 1,
    paddingTop: Platform.OS === "ios" ? 54 : space.xl,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  contentWide: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  wordmark: {
    fontFamily: sans,
    color: theme.gold,
    fontSize: type.caption,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: serif,
    color: theme.ink,
    fontSize: type.display,
    marginTop: space.xs,
  },
  lead: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: type.body,
    lineHeight: 22,
  },
  streak: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    backgroundColor: theme.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  streakName: {
    fontFamily: serif,
    color: theme.ink,
    fontSize: type.title,
  },
  streakValue: {
    fontFamily: serif,
    color: theme.gold,
    fontSize: type.display,
    fontVariant: ["tabular-nums"],
  },
  list: {
    gap: space.sm,
  },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.xs,
  },
  daily: {
    borderColor: theme.gold,
  },
  name: {
    fontFamily: serif,
    color: theme.ink,
    fontSize: type.title,
  },
  sizes: {
    fontFamily: sans,
    color: theme.ink,
    fontSize: type.body,
    fontWeight: "600",
  },
  detail: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: type.small,
    lineHeight: 20,
    marginTop: space.xs,
  },
  starKey: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: type.caption,
    marginTop: space.sm,
  },
  lessonLine: {
    fontFamily: sans,
    color: theme.ink,
    fontSize: type.small,
    fontWeight: "600",
  },
  starOn: {
    color: theme.gold,
  },
  starOff: {
    color: theme.inkSoft,
  },
  status: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: type.body,
    marginTop: space.sm,
  },
  error: {
    fontFamily: sans,
    color: theme.one,
    fontSize: type.body,
    lineHeight: 22,
    marginTop: space.sm,
  },
  back: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: type.body,
    fontWeight: "600",
    marginTop: space.md,
    minHeight: 44,
    lineHeight: 44,
  },
  dim: {
    opacity: 0.45,
  },
});
