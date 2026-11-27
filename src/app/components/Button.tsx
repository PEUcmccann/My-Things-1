import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

interface Props {
  /** Leave it out for an icon-only button, and give an accessibilityLabel. */
  title?: string;
  icon?: IconName;
  /** Defaults to the button's text colour. */
  iconColor?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  kind?: "primary" | "plain" | "danger";
  testID?: string;
  disabled?: boolean;
  small?: boolean;
}

export function Button(props: Props) {
  const { title, icon, iconColor, onPress, kind = "plain", testID, disabled, small } = props;
  const theme = useTheme();
  const primary = kind === "primary";
  const colour = kind === "danger" ? theme.danger : primary ? theme.onAccent : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        small && !title && styles.iconOnly,
        primary && { backgroundColor: theme.accent },
        !primary && { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 17 : 19} color={iconColor ?? colour} /> : null}
      {title ? (
        <Text style={[styles.text, small && styles.smallText, { color: colour }]}>{title}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  small: { paddingHorizontal: 10, paddingVertical: 6 },
  // Keeps an icon-only button as tall as a small button with text.
  iconOnly: { minHeight: 31 },
  text: { fontSize: 16, fontWeight: "600" },
  smallText: { fontSize: 14 },
});
