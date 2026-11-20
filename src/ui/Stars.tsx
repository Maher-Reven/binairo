import { StyleSheet, Text, View } from "react-native";
import type { LessonStars } from "../domain/stars";
import { sans, theme } from "./theme";

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
    gap: 10,
    marginTop: 4,
  },
  star: {
    fontFamily: sans,
    color: theme.coachMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  on: {
    color: theme.gold,
  },
});
