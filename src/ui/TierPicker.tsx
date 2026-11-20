import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TIER_ORDER, tierLabel, tierSizeLabel, tierStart } from "../domain/campaign";
import { hintCost } from "../domain/scoring";
import type { Tier } from "../domain/types";
import { pressable, sans, serif, theme } from "./theme";

interface TierPickerProps {
  busy: boolean;
  error: string | null;
  continued: readonly Tier[];
  dailyStatus: "fresh" | "playing" | "won";
  canBack: boolean;
  onPick: (tier: Tier) => void;
  onDaily: () => void;
  onBack: () => void;
}

export function TierPicker({ busy, error, continued, dailyStatus, canBack, onPick, onDaily, onBack }: TierPickerProps) {
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
      <View style={styles.list}>
        <DailyCard status={dailyStatus} busy={busy} onDaily={onDaily} />
        {TIER_ORDER.map((tier) => (
          <TierCard key={tier} tier={tier} continued={continued.includes(tier)} busy={busy} onPick={onPick} />
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
  onPick,
}: {
  tier: Tier;
  continued: boolean;
  busy: boolean;
  onPick: (tier: Tier) => void;
}) {
  const detail = tierDetail(tier, continued);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tierLabel(tier)}. ${tierSizeLabel(tier)}. ${detail}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={() => onPick(tier)}
      style={[styles.card, pressable, busy ? styles.dim : null]}
    >
      <Text style={styles.name}>{tierLabel(tier)}</Text>
      <Text style={styles.sizes}>{tierSizeLabel(tier)}</Text>
      <Text style={styles.detail}>{detail}</Text>
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
    paddingTop: Platform.OS === "ios" ? 54 : 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 8,
  },
  contentWide: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  wordmark: {
    fontFamily: sans,
    color: theme.gold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: serif,
    color: theme.ink,
    fontSize: 36,
    marginTop: 4,
  },
  lead: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: theme.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  daily: {
    borderColor: theme.gold,
  },
  name: {
    fontFamily: serif,
    color: theme.ink,
    fontSize: 26,
  },
  sizes: {
    fontFamily: sans,
    color: theme.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  detail: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  status: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: 15,
    marginTop: 8,
  },
  error: {
    fontFamily: sans,
    color: theme.one,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  back: {
    fontFamily: sans,
    color: theme.ink,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    minHeight: 44,
    textAlignVertical: "center",
  },
  dim: {
    opacity: 0.45,
  },
});
