import { Platform, useColorScheme } from "react-native";

const claro = {
  paper: "#faf6ef",
  card: "#fffdf8",
  ink: "#2b2622",
  muted: "#7a6f63",
  line: "#e8dfd0",
  accent: "#8a5a2b",
  accentSoft: "#f3e6d3",
  sage: "#5b6b4f",
  onAccent: "#faf6ef",
  danger: "#b3261e",
};

const escuro: typeof claro = {
  paper: "#16130f",
  card: "#1f1b16",
  ink: "#ece4d6",
  muted: "#a39886",
  line: "#332d25",
  accent: "#d9a066",
  accentSoft: "#2c2318",
  sage: "#9bb08a",
  onAccent: "#16130f",
  danger: "#f2b8b5",
};

export type Cores = typeof claro;

export function useCores(): Cores {
  return useColorScheme() === "dark" ? escuro : claro;
}

export const serif = Platform.select({ ios: "Georgia", default: "serif" });
