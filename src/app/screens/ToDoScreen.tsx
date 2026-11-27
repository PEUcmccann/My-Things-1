import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MyThings, ToDo } from "../../core";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { ChecklistEditor } from "../components/ChecklistEditor";
import { FieldRow } from "../components/FieldRow";
import { MovePicker } from "../components/MovePicker";
import { NotesField } from "../components/NotesField";
import { Screen } from "../components/Screen";
import { TagPicker } from "../components/TagPicker";
import { ToDoList } from "../components/ToDoList";
import { DatePicker, WhenPicker } from "../components/WhenPicker";
import { useFinishToDo } from "../finish";
import { formatDate, whenText } from "../format";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

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

type Picker = "when" | "deadline" | "move" | "tags" | null;

export function ToDoScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const finish = useFinishToDo();
  const toDo = app.findToDo(id);
  const [title, setTitle] = useState(toDo?.title ?? "");
  const [newChild, setNewChild] = useState("");
  const [picker, setPicker] = useState<Picker>(null);

  if (!toDo) {
    return (
      <Screen title="To-do">
        <Text style={{ color: theme.muted }}>This To-do no longer exists.</Text>
      </Screen>
    );
  }
  const today = app.currentDate();
  const trashed = app.isInTrash(id);
  const parent = toDo.parentId ? app.findToDo(toDo.parentId) : undefined;
  const children = toDo.parentId
    ? []
    : app.subToDos(id).map((t) => ({ toDo: t, parentTitle: null }));
  const saveTitle = () => app.editToDo(id, { title });
  const addChild = () => {
    if (!newChild.trim()) return;
    app.createToDo({ title: newChild.trim(), parentId: id });
    setNewChild("");
  };

  return (
    <Screen title={parent ? "Sub-to-do" : "To-do"} testID="screen-todo">
      {parent ? (
        <Pressable
          onPress={() => nav.push({ name: "toDo", id: parent.id })}
          style={styles.parent}
          testID="todo-parent"
        >
          <Text style={{ color: theme.muted }}>↳ in {parent.title}</Text>
        </Pressable>
      ) : null}
      <View style={styles.titleRow}>
        <Checkbox
          outcome={toDo.outcome}
          onPress={() => (toDo.outcome === "active" ? finish(id, "completed") : app.reopen(id))}
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
        <FieldRow
          label="When"
          value={whenText(toDo, today)}
          onPress={() => setPicker("when")}
          testID="todo-when"
        />
        <FieldRow
          label="Deadline"
          value={toDo.deadline ? formatDate(toDo.deadline, today) : "None"}
          onPress={() => setPicker("deadline")}
          testID="todo-deadline"
        />
        <FieldRow
          label="Tags"
          value={
            app
              .tagsOf({ kind: "toDo", id })
              .map((t) => t.title)
              .join(", ") || "None"
          }
          onPress={() => setPicker("tags")}
          testID="todo-tags"
        />
        {parent ? null : (
          <FieldRow
            label="Move"
            value={placeText(app, toDo)}
            onPress={() => setPicker("move")}
            testID="todo-move"
          />
        )}
      </View>

      {parent ? null : (
        <View style={styles.children} testID="sub-todos">
          <Text style={[styles.section, { color: theme.muted }]}>Sub-to-dos</Text>
          <ToDoList entries={children} />
          <TextInput
            value={newChild}
            onChangeText={setNewChild}
            onSubmitEditing={addChild}
            blurOnSubmit={false}
            placeholder="＋ Add Sub-to-do"
            placeholderTextColor={theme.muted}
            style={[styles.newChild, { color: theme.text, borderColor: theme.border }]}
            testID="sub-todo-new"
          />
        </View>
      )}

      <View style={styles.actions}>
        {toDo.outcome === "active" ? (
          <>
            <Button
              title="Complete"
              onPress={() => finish(id, "completed")}
              testID="todo-complete"
            />
            <Button
              title="Cancel To-do"
              onPress={() => finish(id, "cancelled")}
              testID="todo-cancel"
            />
          </>
        ) : (
          <Button
            title={toDo.outcome === "completed" ? "Reopen (Completed)" : "Reopen (Cancelled)"}
            onPress={() => app.reopen(id)}
            testID="todo-reopen"
          />
        )}
        {parent ? (
          <Button title="Promote to To-do" onPress={() => app.promote(id)} testID="todo-promote" />
        ) : null}
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
      </View>
      <TagPicker
        visible={picker === "tags"}
        selected={toDo.tagIds}
        onToggle={(tagId, on) =>
          on ? app.addTag({ kind: "toDo", id }, tagId) : app.removeTag({ kind: "toDo", id }, tagId)
        }
        onClose={() => setPicker(null)}
      />
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
  parent: { marginLeft: 8, marginBottom: 4 },
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
  children: { marginTop: 20 },
  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
    marginLeft: 8,
  },
  newChild: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 15 },
});
