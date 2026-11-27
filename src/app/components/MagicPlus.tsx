import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NewToDo } from "../../core";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface Props {
  /** Where a new To-do is filed, based on the screen it was created from. */
  placement: Omit<NewToDo, "title">;
}

/** The add button shown on every list. */
export function MagicPlus({ placement }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const close = () => {
    setOpen(false);
    setTitle("");
  };
  const add = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    app.createToDo({ ...placement, title: trimmed });
    close();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.fab, { backgroundColor: theme.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Add To-do"
        testID="magic-plus"
      >
        <Text style={[styles.plus, { color: theme.onAccent }]}>+</Text>
      </Pressable>
      <Sheet visible={open} onClose={close} testID="new-todo-sheet">
        <Text style={[styles.heading, { color: theme.text }]}>New To-do</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What do you need to do?"
          placeholderTextColor={theme.muted}
          autoFocus
          onSubmitEditing={add}
          returnKeyType="done"
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          testID="new-todo-title"
        />
        <View style={styles.buttons}>
          <Button title="Cancel" onPress={close} />
          <Button title="Add" kind="primary" onPress={add} testID="new-todo-add" />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  plus: { fontSize: 34, lineHeight: 38, fontWeight: "300" },
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 10, padding: 12 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
});
