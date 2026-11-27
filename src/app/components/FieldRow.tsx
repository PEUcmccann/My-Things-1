import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";

interface Props {
  label: string;
  value: string;
  onPress: () => void;
  testID?: string;
}

/** A labelled value that opens a picker when tapped. */
export function FieldRow({ label, value, onPress, testID }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.field, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID={testID}
      accessibilityRole="button"
    >
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 15 },
  value: { fontSize: 15, fontWeight: "500", flexShrink: 1 },
});
