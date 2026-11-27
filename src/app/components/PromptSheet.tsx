import { useState, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
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
  testID?: string;
}

/** Asks for one line of text, such as a name. Mount it only while it is open. */
export function PromptSheet(props: Props) {
  const { title, initial = "", placeholder, confirmTitle = "Save", onSubmit, onClose } = props;
  const theme = useTheme();
  const [text, setText] = useState(initial);
  const submit = () => {
    if (!text.trim()) return;
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
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        testID="prompt-input"
      />
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
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
});
