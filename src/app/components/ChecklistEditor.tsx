import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";

function ItemTitle(props: { title: string; ticked: boolean; onRename: (t: string) => void }) {
  const theme = useTheme();
  const [text, setText] = useState(props.title);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => (text.trim() ? props.onRename(text) : setText(props.title))}
      style={[
        styles.title,
        { color: props.ticked ? theme.muted : theme.text },
        props.ticked && styles.struck,
      ]}
    />
  );
}

interface Props {
  toDoId: string;
  /**
   * Makes an edit that changes the Checklist's contents (adding, renaming or
   * deleting), as a repeating To-do asks first. Ticking and reordering don't go
   * through it.
   */
  edit?: (change: () => void) => void;
}

/** A To-do's Checklist: add, tick, rename, reorder and delete its items. */
export function ChecklistEditor({ toDoId, edit = (change) => change() }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const [draft, setDraft] = useState("");
  const items = app.checklist(toDoId);
  const add = () => {
    if (!draft.trim()) return;
    edit(() => app.addChecklistItem(toDoId, draft));
    setDraft("");
  };
  const small = (label: string, onPress: () => void, testID: string, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.small, disabled && { opacity: 0.25 }]}
      testID={testID}
      accessibilityLabel={testID.split("-")[1]}
    >
      <Text style={{ color: theme.muted, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      style={[styles.box, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID="checklist"
    >
      {items.map((item, i) => (
        <View key={item.id} style={styles.item} testID={`checklist-item-${i}`}>
          <Checkbox
            round
            outcome={item.ticked ? "completed" : "active"}
            onPress={() => app.tickChecklistItem(item.id, !item.ticked)}
            testID={`checklist-tick-${i}`}
          />
          <ItemTitle
            title={item.title}
            ticked={item.ticked}
            onRename={(t) => {
              if (t.trim() !== item.title) edit(() => app.renameChecklistItem(item.id, t));
            }}
          />
          {small("↑", () => app.moveChecklistItem(item.id, i - 1), `checklist-up-${i}`, i === 0)}
          {small(
            "↓",
            () => app.moveChecklistItem(item.id, i + 1),
            `checklist-down-${i}`,
            i === items.length - 1,
          )}
          {small("✕", () => edit(() => app.deleteChecklistItem(item.id)), `checklist-delete-${i}`)}
        </View>
      ))}
      <View style={styles.item}>
        <View style={styles.plus}>
          <Icon name="add" size={16} color={theme.accent} />
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          blurOnSubmit={false}
          placeholder="Add Checklist item"
          placeholderTextColor={theme.muted}
          style={[styles.title, { color: theme.text }]}
          testID="checklist-new"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  title: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 4 },
  struck: { textDecorationLine: "line-through" },
  small: { paddingHorizontal: 4 },
  plus: { width: 22, alignItems: "center" },
});
