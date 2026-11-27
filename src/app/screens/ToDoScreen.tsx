import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { ChecklistEditor } from "../components/ChecklistEditor";
import { NotesField } from "../components/NotesField";
import { MovePicker } from "../components/MovePicker";
import { DatePicker, WhenPicker } from "../components/WhenPicker";
import { Screen } from "../components/Screen";
import { formatDate } from "../format";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import type { MyThings, ToDo } from "../../core";

function whenText(toDo: ToDo, today: string): string {
  if (toDo.someday) return "📦 Someday";
  if (!toDo.startDate) return "No Start date";
  if (toDo.startDate <= today) return toDo.evening ? "🌙 This Evening" : "☀️ Today";
  return formatDate(toDo.startDate, today);
}

/** Where the To-do is filed, for the Move row. */
function placeText(app: MyThings, toDo: ToDo): string {
  if (toDo.projectId) {
    const project = app.findProject(toDo.projectId)?.title ?? "Project";
    const heading = toDo.headingId ? ` › ${app.getHeading(toDo.headingId).title}` : "";
    return `◔ ${project}${heading}`;
  }
  if (toDo.areaId) return `▣ ${app.findArea(toDo.areaId)?.title ?? "Area"}`;
  return toDo.startDate || toDo.someday ? "No Area or Project" : "📥 Inbox";
}

export function ToDoScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const toDo = app.findToDo(id);
  const [title, setTitle] = useState(toDo?.title ?? "");
  const [picker, setPicker] = useState<"when" | "deadline" | "move" | null>(null);

  if (!toDo) {
    return (
      <Screen title="To-do">
        <Text style={{ color: theme.muted }}>This To-do no longer exists.</Text>
      </Screen>
    );
  }
  const today = app.currentDate();
  const trashed = app.isInTrash(id);
  const saveTitle = () => app.editToDo(id, { title });

  const row = (label: string, value: string, onPress: () => void, testID: string) => (
    <Pressable
      onPress={onPress}
      style={[styles.field, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID={testID}
      accessibilityRole="button"
    >
      <Text style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: theme.text }]}>{value}</Text>
    </Pressable>
  );

  return (
    <Screen title="To-do" testID="screen-todo">
      <View style={styles.titleRow}>
        <Checkbox
          outcome={toDo.outcome}
          onPress={() => (toDo.outcome === "active" ? app.complete(id) : app.reopen(id))}
          testID="todo-detail-check"
        />
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={saveTitle}
          onSubmitEditing={saveTitle}
          style={[styles.title, { color: theme.text, borderColor: theme.border }]}
          testID="todo-title"
          accessibilityLabel="Title"
        />
      </View>
      <View style={styles.fields}>
        <NotesField value={toDo.notes} onSave={(notes) => app.editToDo(id, { notes })} />
        <ChecklistEditor toDoId={id} />
        {row("When", whenText(toDo, today), () => setPicker("when"), "todo-when")}
        {row(
          "Deadline",
          toDo.deadline ? formatDate(toDo.deadline, today) : "None",
          () => setPicker("deadline"),
          "todo-deadline",
        )}
        {toDo.parentId
          ? null
          : row("Move", placeText(app, toDo), () => setPicker("move"), "todo-move")}
      </View>
      <View style={styles.actions}>
        {trashed ? (
          <Button
            title="Restore from Trash"
            onPress={() => app.restore(id)}
            testID="todo-restore"
          />
        ) : (
          <Button
            title="Delete"
            kind="danger"
            onPress={() => {
              app.delete(id);
              nav.back();
            }}
            testID="todo-delete"
          />
        )}
        {toDo.outcome === "active" ? (
          <>
            <Button title="Complete" onPress={() => app.complete(id)} testID="todo-complete" />
            <Button title="Cancel To-do" onPress={() => app.cancel(id)} testID="todo-cancel" />
          </>
        ) : (
          <Button
            title={toDo.outcome === "completed" ? "Reopen (Completed)" : "Reopen (Cancelled)"}
            onPress={() => app.reopen(id)}
            testID="todo-reopen"
          />
        )}
      </View>
      <MovePicker
        visible={picker === "move"}
        onChoose={(to) => app.moveToDo(id, to)}
        onClose={() => setPicker(null)}
      />
      <WhenPicker
        visible={picker === "when"}
        current={toDo.startDate}
        onChoose={(when) => app.setWhen(id, when)}
        onClose={() => setPicker(null)}
      />
      <DatePicker
        visible={picker === "deadline"}
        title="Deadline"
        current={toDo.deadline}
        onChoose={(date) => app.setDeadline(id, date)}
        onClose={() => setPicker(null)}
        testID="deadline-picker"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  fields: { marginTop: 16, gap: 8 },
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: { fontSize: 15 },
  fieldValue: { fontSize: 15, fontWeight: "500" },
});
