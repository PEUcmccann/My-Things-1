import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

interface Props<T extends string> {
  options: { value: T; title: string; detail?: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

/** A list of options where one is chosen. */
export function Choice<T extends string>({ options, value, onChange, testID }: Props<T>) {
  const theme = useTheme();
  return (
    <View
      style={[styles.group, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID={testID}
    >
      {options.map((option, i) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[
            styles.option,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
          ]}
          accessibilityRole="radio"
          aria-checked={option.value === value}
          testID={testID ? `${testID}-${option.value}` : undefined}
        >
          <View style={styles.text}>
            <Text style={[styles.title, { color: theme.text }]}>{option.title}</Text>
            {option.detail ? (
              <Text style={[styles.detail, { color: theme.muted }]}>{option.detail}</Text>
            ) : null}
          </View>
          <Text style={[styles.tick, { color: theme.accent }]}>
            {option.value === value ? "✓" : ""}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", padding: 14 },
  text: { flex: 1 },
  title: { fontSize: 16 },
  detail: { fontSize: 13, marginTop: 2 },
  tick: { fontSize: 18, fontWeight: "700", width: 24, textAlign: "right" },
});
