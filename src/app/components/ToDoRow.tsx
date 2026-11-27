import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ToDoEntry } from "../../core";
import { useFinishToDo } from "../finish";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Checkbox } from "./Checkbox";
import { DateBadges } from "./DateBadges";

/** Small hints on a row: notes, and Checklist progress such as 2/5. */
function Indicators({ toDoId, hasNotes }: { toDoId: string; hasNotes: boolean }) {
  const app = useMyThings();
  const theme = useTheme();
  const { ticked, total } = app.checklistProgress(toDoId);
  if (!hasNotes && total === 0) return null;
  return (
    <View style={styles.indicators}>
      {hasNotes ? (
        <Text style={[styles.indicator, { color: theme.muted }]} testID="row-notes">
          📝
        </Text>
      ) : null}
      {total > 0 ? (
        <Text style={[styles.indicator, { color: theme.muted }]} testID="row-checklist">
          ☑ {ticked}/{total}
        </Text>
      ) : null}
    </View>
  );
}

interface Props {
  entry: ToDoEntry;
  onPress?: () => void;
}

export function ToDoRow({ entry, onPress }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const finish = useFinishToDo();
  const { toDo, parentTitle } = entry;
  const finished = toDo.outcome !== "active";
  const toggle = () => (finished ? app.reopen(toDo.id) : finish(toDo.id, "completed"));
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
        <Indicators toDoId={toDo.id} hasNotes={toDo.notes.trim().length > 0} />
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
  indicators: { flexDirection: "row", gap: 10, marginTop: 3 },
  indicator: { fontSize: 12 },
});
