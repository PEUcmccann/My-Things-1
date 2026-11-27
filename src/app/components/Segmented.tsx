import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

interface Props<T extends string> {
  options: { value: T; title: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

/** A row of options side by side where one is chosen, such as List / Timeline. */
export function Segmented<T extends string>({ options, value, onChange, testID }: Props<T>) {
  const theme = useTheme();
  return (
    <View
      style={[styles.group, { backgroundColor: theme.border }]}
      accessibilityRole="radiogroup"
      testID={testID}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, on && { backgroundColor: theme.surface }]}
            accessibilityRole="radio"
            aria-checked={on}
            testID={testID ? `${testID}-${option.value}` : undefined}
          >
            <Text style={[styles.title, { color: on ? theme.text : theme.muted }]}>
              {option.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", borderRadius: 9, padding: 2, marginTop: 8 },
  option: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 7 },
  title: { fontSize: 14, fontWeight: "600" },
});
