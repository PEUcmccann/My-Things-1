import { useColorScheme } from "react-native";

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

const accentTeal = { light: "#0F8B8D", dark: "#3CC6C4" };

const light: Omit<Theme, "accent"> = {
  dark: false,
  background: "#F7F8F8",
  surface: "#FFFFFF",
  border: "#E1E4E6",
  text: "#1B1F23",
  muted: "#69737D",
  onAccent: "#FFFFFF",
  danger: "#C62D3B",
  warning: "#B86E00",
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

/** Colours for the current light/dark setting. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { ...(isDark ? dark : light), accent: isDark ? accentTeal.dark : accentTeal.light };
}
