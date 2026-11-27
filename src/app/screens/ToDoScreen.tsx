import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DatePicker, WhenPicker } from "../components/WhenPicker";
import { Screen } from "../components/Screen";
import { formatDate } from "../format";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import type { ToDo } from "../../core";

function whenText(toDo: ToDo, today: string): string {
  if (toDo.someday) return "📦 Someday";
  if (!toDo.startDate) return "No Start date";
  if (toDo.startDate <= today) return toDo.evening ? "🌙 This Evening" : "☀️ Today";
  return formatDate(toDo.startDate, today);
}

export function ToDoScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const toDo = app.findToDo(id);
  const [title, setTitle] = useState(toDo?.title ?? "");
  const [picker, setPicker] = useState<"when" | "deadline" | null>(null);

  if (!toDo) {
    return (
      <Screen title="To-do">
        <Text style={{ color: theme.muted }}>This To-do no longer exists.</Text>
      </Screen>
    );
  }
  const today = app.currentDate();
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
      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={saveTitle}
        onSubmitEditing={saveTitle}
        style={[styles.title, { color: theme.text, borderColor: theme.border }]}
        testID="todo-title"
        accessibilityLabel="Title"
      />
      <View style={styles.fields}>
        {row("When", whenText(toDo, today), () => setPicker("when"), "todo-when")}
        {row(
          "Deadline",
          toDo.deadline ? formatDate(toDo.deadline, today) : "None",
          () => setPicker("deadline"),
          "todo-deadline",
        )}
      </View>
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
  title: {
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
