import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TIER_ORDER, tierLabel, tierSizeLabel, tierStart } from "../domain/campaign";
import { hintCost } from "../domain/scoring";
import type { Tier } from "../domain/types";
import { pressable, sans, serif, theme } from "./theme";

interface TierPickerProps {
  busy: boolean;
  error: string | null;
  canBack: boolean;
  onPick: (tier: Tier) => void;
  onBack: () => void;
}

export function TierPicker({ busy, error, canBack, onPick, onBack }: TierPickerProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, wide ? styles.contentWide : null]}
    >
      <Text style={styles.wordmark}>Binairo</Text>
      <Text style={styles.title}>Choose a tier</Text>
      <Text style={styles.lead}>The game starts at the tier you pick. Points and streaks stay with you.</Text>
      <View style={styles.list}>
        {TIER_ORDER.map((tier) => (
          <TierCard key={tier} tier={tier} busy={busy} onPick={onPick} />
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

function TierCard({ tier, busy, onPick }: { tier: Tier; busy: boolean; onPick: (tier: Tier) => void }) {
  const detail = tierDetail(tier);
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

function tierDetail(tier: Tier): string {
  const start = tierStart(tier);
  const cost = hintCost(tier);
  const hint = cost === 0 ? "Hints are free." : `A hint costs ${cost} points.`;
  const rules = tier === "junior" ? "One new rule at a time." : "All three rules.";
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
