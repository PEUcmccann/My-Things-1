import { useColorScheme } from "react-native";
import type { AccentColour } from "../core";
import { useOptionalMyThings } from "./state";

export interface Theme {
  dark: boolean;
  background: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  danger: string;
  warning: string;
}

/**
 * Each accent in light and dark. Light versions reach at least 4.5:1 against
 * white surfaces, dark versions at least 6.8:1 against dark surfaces.
 */
export const accents: Record<AccentColour, { name: string; light: string; dark: string }> = {
  teal: { name: "Teal", light: "#0B7A7C", dark: "#3CC6C4" },
  blue: { name: "Blue", light: "#1F63C6", dark: "#6AA8FF" },
  indigo: { name: "Indigo", light: "#5145CD", dark: "#A39BFF" },
  orange: { name: "Orange", light: "#B4530A", dark: "#F5A253" },
  rose: { name: "Rose", light: "#C0265A", dark: "#FF7FA6" },
  green: { name: "Green", light: "#2E7D32", dark: "#6CCB71" },
};

const light: Omit<Theme, "accent"> = {
  dark: false,
  background: "#F7F8F8",
  surface: "#FFFFFF",
  border: "#E1E4E6",
  text: "#1B1F23",
  muted: "#69737D",
  onAccent: "#FFFFFF",
  danger: "#C62D3B",
  warning: "#9A5B00",
};

const dark: Omit<Theme, "accent"> = {
  dark: true,
  background: "#121416",
  surface: "#1C1F22",
  border: "#2E3337",
  text: "#ECEFF1",
  muted: "#9AA4AD",
  onAccent: "#0B1214",
  danger: "#FF6B76",
  warning: "#F0A848",
};

/** Colours for the current light/dark setting and the chosen accent colour. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const app = useOptionalMyThings();
  const isDark = scheme === "dark";
  const accent = accents[app?.accentColour() ?? "teal"] ?? accents.teal;
  return { ...(isDark ? dark : light), accent: isDark ? accent.dark : accent.light };
}
