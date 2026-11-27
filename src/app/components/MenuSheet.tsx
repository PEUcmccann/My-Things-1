import { Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";
import { Sheet } from "./Sheet";

export interface MenuOption {
  title: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
  /** Indents the option, as for a Project under its Area. */
  depth?: number;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  options: MenuOption[];
  onClose: () => void;
  testID?: string;
}

/** A list of choices. Choosing one closes the menu first. */
export function MenuSheet({ visible, title, message, options, onClose, testID }: Props) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} testID={testID ?? "menu"}>
      {title ? <Text style={[styles.heading, { color: theme.text }]}>{title}</Text> : null}
      {message ? <Text style={[styles.message, { color: theme.muted }]}>{message}</Text> : null}
      <ScrollView>
        {options.map((option, i) => (
          <Pressable
            key={`${option.title}-${i}`}
            disabled={option.disabled}
            onPress={() => {
              onClose();
              // iOS cannot show another sheet while this one is still sliding away.
              if (Platform.OS === "ios") setTimeout(option.onPress, 450);
              else option.onPress();
            }}
            style={({ pressed }) => [
              styles.option,
              { borderColor: theme.border, paddingLeft: 12 + (option.depth ?? 0) * 20 },
              (pressed || option.disabled) && { opacity: 0.5 },
            ]}
            testID={option.testID}
            accessibilityRole="button"
          >
            <Text style={[styles.text, { color: option.danger ? theme.danger : theme.text }]}>
              {option.title}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.option} testID="menu-close">
          <Text style={[styles.text, { color: theme.muted }]}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  message: { fontSize: 14, marginBottom: 8 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 16 },
});
