import { StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";

export function Empty({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.text, { color: theme.muted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: { textAlign: "center", marginTop: 48, fontSize: 15 },
});
