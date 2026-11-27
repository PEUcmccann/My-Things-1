import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

/** The Tags selected in a list's filter bar, and the bar itself. */
export function useTagFilter(): { selected: string[]; bar: React.ReactNode } {
  const [selected, setSelected] = useState<string[]>([]);
  // Forget Tags that have been deleted.
  const app = useMyThings();
  const live = selected.filter((id) => app.findTag(id));
  return {
    selected: live,
    bar: <TagFilterBar selected={live} onChange={setSelected} />,
  };
}

function TagFilterBar(props: { selected: string[]; onChange: (ids: string[]) => void }) {
  const app = useMyThings();
  const theme = useTheme();
  const tags = app.tagTree();
  if (tags.length === 0) return null;
  const toggle = (id: string) =>
    props.onChange(
      props.selected.includes(id)
        ? props.selected.filter((t) => t !== id)
        : [...props.selected, id],
    );
  const chip = (key: string, title: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: on ? theme.accent : theme.border },
        on && { backgroundColor: theme.accent },
      ]}
      testID={`tag-filter-${key}`}
      aria-checked={on}
      accessibilityRole="checkbox"
    >
      <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 13 }}>{title}</Text>
    </Pressable>
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
      testID="tag-filter"
    >
      {chip("all", "All", props.selected.length === 0, () => props.onChange([]))}
      {tags.map(({ tag }) =>
        chip(tag.id, tag.title, props.selected.includes(tag.id), () => toggle(tag.id)),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { marginTop: 8, flexGrow: 0 },
  content: { gap: 6, paddingRight: 12 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
});
