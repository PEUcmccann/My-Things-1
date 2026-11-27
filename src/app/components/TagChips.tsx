import { StyleSheet, Text, View } from "react-native";
import type { Tag } from "../../core";
import { useTheme } from "../theme";

/** The Tags on a row, as small chips. */
export function TagChips({ tags }: { tags: Tag[] }) {
  const theme = useTheme();
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((t) => (
        <Text
          key={t.id}
          style={[styles.chip, { color: theme.muted, borderColor: theme.border }]}
          testID={`tag-chip-${t.id}`}
        >
          {t.title}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  chip: {
    fontSize: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
});
