import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStore } from "./storage";

export const asyncStorage: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
