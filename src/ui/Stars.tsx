import { StyleSheet, Text, View } from "react-native";
import type { LessonStars } from "../domain/stars";
import { sans, space, theme, type } from "./theme";

const NAMES = [
  ["Clean", "clean"],
  ["Par", "par"],
  ["No hint", "hint"],
] as const;

export function StarReadout({ stars }: { stars: LessonStars }) {
  return (
    <View style={styles.row}>
      {NAMES.map(([label, key]) => {
        const earned = stars[key];
        return (
          <Text
            key={key}
            accessibilityLabel={earned ? `${label} star earned` : `${label} star not earned`}
            style={[styles.star, earned ? styles.on : null]}
          >
            {earned ? "★" : "☆"} {label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.xs,
  },
  star: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: type.small,
    fontWeight: "600",
  },
  on: {
    color: theme.accentOnDark,
  },
});
