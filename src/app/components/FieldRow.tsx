import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

interface Props {
  label: string;
  value: string;
  /** Shown before the value. */
  icon?: IconName;
  /** Defaults to the list's colour for a list icon, otherwise the text colour. */
  iconColor?: string;
  onPress: () => void;
  testID?: string;
}

/** A labelled value that opens a picker when tapped. */
export function FieldRow({ label, value, icon, iconColor, onPress, testID }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.field, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID={testID}
      accessibilityRole="button"
    >
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <View style={styles.valueRow}>
        {icon ? <Icon name={icon} size={16} color={iconColor} /> : null}
        <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
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
  valueRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  value: { fontSize: 15, fontWeight: "500", flexShrink: 1 },
});
