import { useState, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface Props {
  title: string;
  initial?: string;
  placeholder?: string;
  confirmTitle?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
  /** Extra controls under the text field. */
  children?: ReactNode;
  /** Checks the text before saving: returns why it is refused, or null to accept it. */
  validate?: (text: string) => string | null;
  keyboardType?: KeyboardTypeOptions;
  testID?: string;
}

/** Asks for one line of text, such as a name. Mount it only while it is open. */
export function PromptSheet(props: Props) {
  const { title, initial = "", placeholder, confirmTitle = "Save", onSubmit, onClose } = props;
  const theme = useTheme();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!text.trim()) return;
    const refused = props.validate?.(text.trim()) ?? null;
    setError(refused);
    if (refused) return;
    onSubmit(text.trim());
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} testID={props.testID ?? "prompt"}>
      <Text style={[styles.heading, { color: theme.text }]}>{title}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        autoFocus
        onSubmitEditing={submit}
        returnKeyType="done"
        keyboardType={props.keyboardType}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        testID="prompt-input"
      />
      {error ? (
        <Text style={[styles.error, { color: theme.danger }]} testID="prompt-error">
          {error}
        </Text>
      ) : null}
      {props.children}
      <View style={styles.buttons}>
        <Button title="Cancel" onPress={onClose} />
        <Button title={confirmTitle} kind="primary" onPress={submit} testID="prompt-confirm" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 10, padding: 12 },
  error: { fontSize: 14, marginTop: 8 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
});
