import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { MagicPlus } from "../components/MagicPlus";
import { MenuSheet } from "../components/MenuSheet";
import { ProgressPie } from "../components/ProgressPie";
import { PromptSheet } from "../components/PromptSheet";
import { Screen } from "../components/Screen";
import { TagChips } from "../components/TagChips";
import { useTagFilter } from "../components/TagFilter";
import { TagPicker } from "../components/TagPicker";
import { ToDoList } from "../components/ToDoList";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

type Dialog = "menu" | "rename" | "delete" | "newProject" | "tags" | null;

export function AreaScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const filter = useTagFilter();
  const area = app.findArea(id);
  if (!area) {
    return (
      <Screen title="Area">
        <Empty text="This Area no longer exists." />
      </Screen>
    );
  }
  const contents = app.areaContents(id);
  const projects = app.filterProjectsByTags(contents.projects, filter.selected);
  const toDos = app.filterByTags(contents.toDos, filter.selected);
  const close = () => setDialog(null);
  return (
    <View style={styles.fill}>
      <Screen
        title={area.title}
        testID="screen-area"
        selectable
        header={
          <>
            <TagChips tags={app.tagsOf({ kind: "area", id })} />
            {filter.bar}
          </>
        }
        actions={<Button small title="•••" onPress={() => setDialog("menu")} testID="area-menu" />}
      >
        {projects.length === 0 && toDos.length === 0 ? <Empty text="Nothing here yet" /> : null}
        {projects.map((p) => {
          const progress = app.projectProgress(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => nav.push({ name: "project", id: p.id })}
              style={[
                styles.project,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              testID={`area-project-${p.id}`}
            >
              <ProgressPie share={progress.total ? progress.completed / progress.total : 0} />
              <Text style={[styles.projectTitle, { color: theme.text }]}>{p.title}</Text>
            </Pressable>
          );
        })}
        {toDos.length > 0 && projects.length > 0 ? <View style={styles.gap} /> : null}
        <ToDoList entries={toDos} list={{ kind: "area", id }} />
      </Screen>
      <MagicPlus placement={{ areaId: id }} />
      <MenuSheet
        visible={dialog === "menu"}
        title={area.title}
        onClose={close}
        options={[
          {
            title: "New Project here",
            onPress: () => setDialog("newProject"),
            testID: "area-new-project",
          },
          { title: "Tags…", onPress: () => setDialog("tags"), testID: "area-tags" },
          { title: "Rename", onPress: () => setDialog("rename"), testID: "area-rename" },
          {
            title: "Delete Area…",
            danger: true,
            onPress: () => setDialog("delete"),
            testID: "area-delete",
          },
        ]}
      />
      <MenuSheet
        visible={dialog === "delete"}
        title={`Delete “${area.title}”?`}
        message="Its Projects are kept with no Area, and its To-dos go back to the Inbox."
        onClose={close}
        options={[
          {
            title: "Delete Area",
            danger: true,
            onPress: () => {
              app.deleteArea(id);
              nav.back();
            },
            testID: "area-delete-confirm",
          },
        ]}
      />
      <TagPicker
        visible={dialog === "tags"}
        selected={area.tagIds}
        onToggle={(tagId, on) =>
          on ? app.addTag({ kind: "area", id }, tagId) : app.removeTag({ kind: "area", id }, tagId)
        }
        onClose={close}
      />
      {dialog === "rename" ? (
        <PromptSheet
          title="Rename Area"
          initial={area.title}
          onSubmit={(t) => app.renameArea(id, t)}
          onClose={close}
        />
      ) : null}
      {dialog === "newProject" ? (
        <PromptSheet
          title="New Project"
          placeholder="Project name"
          confirmTitle="Create"
          onSubmit={(t) =>
            nav.push({ name: "project", id: app.createProject({ title: t, areaId: id }) })
          }
          onClose={close}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  project: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  projectTitle: { fontSize: 16, fontWeight: "600" },
  gap: { height: 12 },
});
