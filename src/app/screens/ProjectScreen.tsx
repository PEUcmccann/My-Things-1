import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { MagicPlus } from "../components/MagicPlus";
import { MenuSheet } from "../components/MenuSheet";
import { ProgressPie } from "../components/ProgressPie";
import { PromptSheet } from "../components/PromptSheet";
import { Screen } from "../components/Screen";
import { ToDoList } from "../components/ToDoList";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

type Dialog = "menu" | "rename" | "moveArea" | null;

export function ProjectScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const [dialog, setDialog] = useState<Dialog>(null);
  const project = app.findProject(id);
  if (!project) {
    return (
      <Screen title="Project">
        <Empty text="This Project no longer exists." />
      </Screen>
    );
  }
  const progress = app.projectProgress(id);
  const share = progress.total ? progress.completed / progress.total : 0;
  const entries = app.projectToDos(id);
  const close = () => setDialog(null);
  return (
    <View style={styles.fill}>
      <Screen
        title={project.title}
        testID="screen-project"
        actions={
          <Button small title="•••" onPress={() => setDialog("menu")} testID="project-menu" />
        }
        header={
          <View style={styles.progress} testID="project-progress">
            <ProgressPie share={share} />
            <Text style={{ color: theme.muted }}>
              {progress.completed} of {progress.total} Completed
            </Text>
          </View>
        }
      >
        {entries.length === 0 ? <Empty text="No To-dos yet" /> : null}
        <ToDoList entries={entries} />
      </Screen>
      <MagicPlus placement={{ projectId: id }} />
      <MenuSheet
        visible={dialog === "menu"}
        title={project.title}
        onClose={close}
        options={[
          { title: "Rename", onPress: () => setDialog("rename"), testID: "project-rename" },
          { title: "Move to Area…", onPress: () => setDialog("moveArea"), testID: "project-move" },
        ]}
      />
      <MenuSheet
        visible={dialog === "moveArea"}
        title="Move to Area"
        onClose={close}
        options={[
          { title: "No Area", onPress: () => app.moveProject(id, null) },
          ...app.areas().map((a) => ({
            title: a.title,
            onPress: () => app.moveProject(id, a.id),
            testID: `project-move-${a.id}`,
          })),
        ]}
      />
      {dialog === "rename" ? (
        <PromptSheet
          title="Rename Project"
          initial={project.title}
          onSubmit={(t) => app.renameProject(id, t)}
          onClose={close}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  progress: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
});
