import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ToDoEntry } from "../../core";
import { useTheme } from "../theme";
import { DateBadges } from "./DateBadges";

interface Props {
  entry: ToDoEntry;
  onPress?: () => void;
}

export function ToDoRow({ entry, onPress }: Props) {
  const theme = useTheme();
  const { toDo, parentTitle } = entry;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`todo-row-${toDo.id}`}
      accessibilityLabel={toDo.title}
    >
      <View style={[styles.box, { borderColor: theme.muted }]} />
      <View style={styles.body}>
        {parentTitle ? (
          <Text style={[styles.parent, { color: theme.muted }]} numberOfLines={1}>
            {parentTitle}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {toDo.title}
        </Text>
        <DateBadges toDo={toDo} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
    gap: 12,
  },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5 },
  body: { flex: 1 },
  parent: { fontSize: 12, marginBottom: 2 },
  title: { fontSize: 16 },
});
