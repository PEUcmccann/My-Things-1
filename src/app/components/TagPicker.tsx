import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface Props {
  visible: boolean;
  title?: string;
  /** Tags ticked when the picker opens. */
  selected: string[];
  onToggle: (tagId: string, on: boolean) => void;
  onClose: () => void;
}

/** Ticks Tags on and off for an item, and can create a new Tag on the spot. */
export function TagPicker({ visible, title = "Tags", selected, onToggle, onClose }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const [draft, setDraft] = useState("");
  if (!visible) return null;
  const create = () => {
    if (!draft.trim()) return;
    onToggle(app.createTag(draft), true);
    setDraft("");
  };
  return (
    <Sheet visible={visible} onClose={onClose} testID="tag-picker">
      <Text style={[styles.heading, { color: theme.text }]}>{title}</Text>
      <ScrollView style={styles.list}>
        {app.tagTree().map(({ tag, depth }) => {
          const on = selected.includes(tag.id);
          return (
            <Pressable
              key={tag.id}
              onPress={() => onToggle(tag.id, !on)}
              style={[styles.option, { paddingLeft: 8 + depth * 20, borderColor: theme.border }]}
              accessibilityRole="checkbox"
              aria-checked={on}
              testID={`tag-option-${tag.id}`}
            >
              <Text style={[styles.text, { color: theme.text }]}>{tag.title}</Text>
              <Text style={[styles.tick, { color: theme.accent }]}>{on ? "✓" : ""}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.create}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={create}
          placeholder="New Tag"
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          testID="tag-picker-new"
        />
        <Button title="Add" onPress={create} testID="tag-picker-add" />
      </View>
      <View style={styles.done}>
        <Button title="Done" kind="primary" onPress={onClose} testID="tag-picker-done" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  list: { maxHeight: 320 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, fontSize: 16 },
  tick: { fontSize: 18, fontWeight: "700" },
  create: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15 },
  done: { alignItems: "flex-end", marginTop: 12 },
});
