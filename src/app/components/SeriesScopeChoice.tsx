import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SeriesScope } from "../../core";
import { useTheme } from "../theme";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

interface Props {
  visible: boolean;
  onChoose: (scope: SeriesScope) => void;
  /** Backs out: the edit is not made. */
  onBackOut: () => void;
}

const options: { scope: SeriesScope; title: string; testID: string }[] = [
  { scope: "thisOne", title: "This one", testID: "series-this-one" },
  { scope: "allFuture", title: "All future ones", testID: "series-all-future" },
];

/** Asks whether an edit to a repeating To-do is for this one or all future ones. */
export function SeriesScopeChoice({ visible, onChoose, onBackOut }: Props) {
  const theme = useTheme();
  const row = [styles.option, { borderColor: theme.border }];
  return (
    <Sheet visible={visible} onClose={onBackOut} testID="series-scope">
      <View style={styles.headingRow}>
        <Icon name="repeat" size={18} color={theme.muted} />
        <Text style={[styles.heading, { color: theme.text }]}>Repeating To-do</Text>
      </View>
      <Text style={[styles.message, { color: theme.muted }]}>
        Change only this one, or this one and all future ones?
      </Text>
      {options.map((o) => (
        <Pressable
          key={o.scope}
          onPress={() => onChoose(o.scope)}
          style={({ pressed }) => [row, pressed && { opacity: 0.5 }]}
          testID={o.testID}
          accessibilityRole="button"
        >
          <Text style={[styles.text, { color: theme.text }]}>{o.title}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onBackOut} style={styles.option} testID="series-back-out">
        <Text style={[styles.text, { color: theme.muted }]}>Cancel</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  heading: { fontSize: 18, fontWeight: "600" },
  message: { fontSize: 14, marginBottom: 8 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 16 },
});
