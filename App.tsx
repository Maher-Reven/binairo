import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { Game } from "./src/ui/Game";
import { asyncStorage } from "./src/persistence/asyncStorage";
import { theme } from "./src/ui/theme";

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Game storage={asyncStorage} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.paper,
  },
});
