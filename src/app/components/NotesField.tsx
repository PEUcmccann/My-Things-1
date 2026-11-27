import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { useTheme } from "../theme";
import { Markdown } from "./Markdown";

interface Props {
  value: string;
  onSave: (notes: string) => void;
  testID?: string;
}

/** Notes in Markdown: shown formatted, and edited as plain text when tapped. */
export function NotesField({ value, onSave, testID = "notes" }: Props) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const box = [styles.box, { borderColor: theme.border, backgroundColor: theme.surface }];

  if (editing) {
    return (
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => {
          setEditing(false);
          if (text !== value) onSave(text);
        }}
        multiline
        autoFocus
        placeholder="Notes (Markdown)"
        placeholderTextColor={theme.muted}
        style={[box, styles.input, { color: theme.text }]}
        testID={`${testID}-input`}
      />
    );
  }
  return (
    <Pressable
      onPress={() => {
        setText(value);
        setEditing(true);
      }}
      style={box}
      testID={testID}
      accessibilityRole="button"
      accessibilityHint="Edit notes"
    >
      {value.trim() ? (
        <Markdown source={value} />
      ) : (
        <Text style={{ color: theme.muted }}>Notes</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, minHeight: 48 },
  input: { minHeight: 120, fontSize: 15, textAlignVertical: "top" },
});
