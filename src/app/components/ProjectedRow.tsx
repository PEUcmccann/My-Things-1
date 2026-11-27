import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LocalDate, Tag, ToDo } from "../../core";
import { useTheme } from "../theme";
import { Icon } from "./Icon";
import { TagChips } from "./TagChips";

interface Props {
  /** The current occurrence the projected date belongs to, as the series is. */
  toDo: ToDo;
  /** The series' Tags, which the later occurrence will have. */
  tags: Tag[];
  date: LocalDate;
  onPress?: () => void;
}

/**
 * A later date of a repeating To-do, worked out from its rule. It isn't a To-do, so
 * it has no checkbox: a dashed outline and the repeat marker take its place, and
 * tapping it opens the current occurrence.
 */
export function ProjectedRow({ toDo, tags, date, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { borderColor: theme.border }]}
      testID={`projected-row-${toDo.id}-${date}`}
      accessibilityRole="button"
      accessibilityHint="Opens the current occurrence"
    >
      <View style={styles.marker} testID="projected-repeat" accessibilityLabel="Repeats">
        <Icon name="repeat" size={16} color={theme.muted} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.muted }]} numberOfLines={2}>
          {toDo.title}
        </Text>
        <TagChips tags={tags} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 6,
    gap: 12,
  },
  marker: { width: 22, alignItems: "center" },
  body: { flex: 1 },
  title: { fontSize: 16 },
});
