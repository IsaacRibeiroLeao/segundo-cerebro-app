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
  paper: "#110e0b",
  card: "#1a1611",
  ink: "#f0e8da",
  muted: "#a89c8a",
  line: "#3a2f22",
  accent: "#e0a85f",
  accentSoft: "#2e2214",
  sage: "#9bb08a",
  onAccent: "#110e0b",
  danger: "#f2b8b5",
};

export type Cores = typeof claro;

export function useCores(): Cores {
  return useColorScheme() === "dark" ? escuro : claro;
}

export const serif = Platform.select({ ios: "Georgia", default: "serif" });
