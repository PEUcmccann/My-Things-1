import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";

interface Props {
  title: string;
  onPress: () => void;
  kind?: "primary" | "plain" | "danger";
  testID?: string;
  disabled?: boolean;
  small?: boolean;
}

export function Button({ title, onPress, kind = "plain", testID, disabled, small }: Props) {
  const theme = useTheme();
  const primary = kind === "primary";
  const colour = kind === "danger" ? theme.danger : primary ? theme.onAccent : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        primary && { backgroundColor: theme.accent },
        !primary && { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.text, small && styles.smallText, { color: colour }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  small: { paddingHorizontal: 10, paddingVertical: 6 },
  text: { fontSize: 16, fontWeight: "600" },
  smallText: { fontSize: 14 },
});
