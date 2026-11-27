import { Pressable, StyleSheet, Text } from "react-native";
import type { Outcome } from "../../core";
import { useTheme } from "../theme";

interface Props {
  outcome: Outcome;
  onPress: () => void;
  testID?: string;
  round?: boolean;
}

/** Ticks a To-do: empty when active, ✓ when Completed, ✕ when Cancelled. */
export function Checkbox({ outcome, onPress, testID, round }: Props) {
  const theme = useTheme();
  const completed = outcome === "completed";
  const cancelled = outcome === "cancelled";
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      testID={testID}
      accessibilityRole="checkbox"
      aria-checked={outcome !== "active"}
      accessibilityLabel={completed ? "Completed" : cancelled ? "Cancelled" : "Complete"}
      style={[
        styles.box,
        round && styles.round,
        { borderColor: completed ? theme.accent : theme.muted },
        completed && { backgroundColor: theme.accent },
        cancelled && { backgroundColor: theme.border, borderColor: theme.border },
      ]}
    >
      {completed ? <Text style={[styles.mark, { color: theme.onAccent }]}>✓</Text> : null}
      {cancelled ? <Text style={[styles.mark, { color: theme.muted }]}>✕</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  round: { borderRadius: 11 },
  mark: { fontSize: 14, fontWeight: "800", lineHeight: 16 },
});
