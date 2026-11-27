import { Pressable, StyleSheet, Text, View } from "react-native";
import { SelectionBar } from "../components/SelectionBar";
import { useSelection } from "../selection";
import { Empty } from "../components/Empty";
import { ProjectRow } from "../components/ProjectRow";
import { Screen } from "../components/Screen";
import { ToDoList } from "../components/ToDoList";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

/** Everything with a Tag, including Tags nested under it. */
export function TagScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const selection = useSelection();
  const tag = app.findTag(id);
  if (!tag) {
    return (
      <Screen title="Tag">
        <Empty text="This Tag no longer exists." />
      </Screen>
    );
  }
  const { areas, projects, toDos } = app.tagged(id);
  return (
    <View style={{ flex: 1 }}>
      <Screen title={`🏷 ${tag.title}`} testID="screen-tag" selectable searchable>
        {areas.length + projects.length + toDos.length === 0 ? (
          <Empty text="Nothing has this Tag" />
        ) : null}
        {areas.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => nav.push({ name: "area", id: a.id })}
            style={[styles.area, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>▣ {a.title}</Text>
          </Pressable>
        ))}
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
        <ToDoList entries={toDos} />
      </Screen>
      {selection.active ? <SelectionBar /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { padding: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
});
