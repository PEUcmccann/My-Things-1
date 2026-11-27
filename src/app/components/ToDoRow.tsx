import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ToDoEntry } from "../../core";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Checkbox } from "./Checkbox";
import { DateBadges } from "./DateBadges";

interface Props {
  entry: ToDoEntry;
  onPress?: () => void;
}

export function ToDoRow({ entry, onPress }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const { toDo, parentTitle } = entry;
  const finished = toDo.outcome !== "active";
  const toggle = () => (finished ? app.reopen(toDo.id) : app.complete(toDo.id));
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`todo-row-${toDo.id}`}
    >
      <Checkbox outcome={toDo.outcome} onPress={toggle} testID={`todo-check-${toDo.id}`} />
      <View style={styles.body}>
        {parentTitle ? (
          <Text style={[styles.parent, { color: theme.muted }]} numberOfLines={1}>
            ↳ {parentTitle}
          </Text>
        ) : null}
        <Text
          style={[
            styles.title,
            { color: finished ? theme.muted : theme.text },
            finished && styles.struck,
          ]}
          numberOfLines={2}
          testID={finished ? `finished-${toDo.outcome}` : undefined}
        >
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
  body: { flex: 1 },
  parent: { fontSize: 12, marginBottom: 2 },
  title: { fontSize: 16 },
  struck: { textDecorationLine: "line-through" },
});
