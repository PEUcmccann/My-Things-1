import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Project, Remaining } from "../../core";
import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { FieldRow } from "../components/FieldRow";
import { MagicPlus } from "../components/MagicPlus";
import { NotesField } from "../components/NotesField";
import { MenuSheet } from "../components/MenuSheet";
import { ProgressPie } from "../components/ProgressPie";
import { PromptSheet } from "../components/PromptSheet";
import { Screen } from "../components/Screen";
import { ToDoList } from "../components/ToDoList";
import { DatePicker, WhenPicker } from "../components/WhenPicker";
import { formatDate } from "../format";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

type Dialog =
  | "menu"
  | "newHeading"
  | { heading: string; action: "menu" | "rename" | "delete" | "add" }
  | "rename"
  | "moveArea"
  | "when"
  | "deadline"
  | { finish: "completed" | "cancelled" }
  | null;

function whenText(project: Project, today: string): string {
  if (project.someday) return "📦 Someday";
  if (!project.startDate) return "No Start date";
  if (project.startDate <= today) return "☀️ Today";
  return formatDate(project.startDate, today);
}

export function ProjectScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const project = app.findProject(id);
  if (!project) {
    return (
      <Screen title="Project">
        <Empty text="This Project no longer exists." />
      </Screen>
    );
  }
  const today = app.currentDate();
  const progress = app.projectProgress(id);
  const share = progress.total ? progress.completed / progress.total : 0;
  const contents = app.projectContents(id);
  const isEmpty = contents.toDos.length === 0 && contents.headings.length === 0;
  const close = () => setDialog(null);
  const finished = project.outcome !== "active";

  const finish = (outcome: "completed" | "cancelled", remaining?: Remaining) => {
    if (outcome === "completed") app.completeProject(id, { remaining });
    else app.cancelProject(id, { remaining });
  };
  const askToFinish = (outcome: "completed" | "cancelled") => {
    if (app.openToDoCount(id) > 0) setDialog({ finish: outcome });
    else finish(outcome);
  };
  const finishing =
    dialog && typeof dialog === "object" && "finish" in dialog ? dialog.finish : null;
  const headingDialog = dialog && typeof dialog === "object" && "heading" in dialog ? dialog : null;
  const dialogHeading = headingDialog ? app.getHeading(headingDialog.heading) : null;

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
        {finished ? (
          <View style={[styles.banner, { backgroundColor: theme.border }]}>
            <Text style={{ color: theme.text, flex: 1 }}>
              This Project is {project.outcome === "completed" ? "Completed" : "Cancelled"}.
            </Text>
            <Button
              small
              title="Reopen"
              onPress={() => app.reopenProject(id)}
              testID="project-reopen"
            />
          </View>
        ) : null}
        <View style={styles.fields}>
          <NotesField
            value={project.notes}
            onSave={(notes) => app.setProjectNotes(id, notes)}
            testID="project-notes"
          />
          <FieldRow
            label="When"
            value={whenText(project, today)}
            onPress={() => setDialog("when")}
            testID="project-when"
          />
          <FieldRow
            label="Deadline"
            value={project.deadline ? formatDate(project.deadline, today) : "None"}
            onPress={() => setDialog("deadline")}
            testID="project-deadline"
          />
        </View>
        {isEmpty ? <Empty text="No To-dos yet" /> : null}
        <ToDoList entries={contents.toDos} />
        {contents.headings.map(({ heading, toDos }) => (
          <View key={heading.id} testID={`heading-${heading.id}`}>
            <View style={[styles.heading, { borderColor: theme.accent }]}>
              <Text style={[styles.headingTitle, { color: theme.accent }]}>{heading.title}</Text>
              <Button
                small
                title="＋"
                onPress={() => setDialog({ heading: heading.id, action: "add" })}
                testID={`heading-add-${heading.id}`}
              />
              <Button
                small
                title="•••"
                onPress={() => setDialog({ heading: heading.id, action: "menu" })}
                testID={`heading-menu-${heading.id}`}
              />
            </View>
            <ToDoList entries={toDos} />
          </View>
        ))}
      </Screen>
      <MagicPlus placement={{ projectId: id }} />
      <MenuSheet
        visible={dialog === "menu"}
        title={project.title}
        onClose={close}
        options={[
          ...(finished
            ? []
            : [
                {
                  title: "Complete Project",
                  onPress: () => askToFinish("completed"),
                  testID: "project-complete",
                },
                {
                  title: "Cancel Project",
                  onPress: () => askToFinish("cancelled"),
                  testID: "project-cancel",
                },
              ]),
          {
            title: "Add Heading",
            onPress: () => setDialog("newHeading"),
            testID: "project-add-heading",
          },
          { title: "Rename", onPress: () => setDialog("rename"), testID: "project-rename" },
          { title: "Move to Area…", onPress: () => setDialog("moveArea"), testID: "project-move" },
          {
            title: "Delete Project",
            danger: true,
            onPress: () => {
              app.deleteProject(id);
              nav.back();
            },
            testID: "project-delete",
          },
        ]}
      />
      <MenuSheet
        visible={finishing !== null}
        title={finishing === "completed" ? "Complete Project" : "Cancel Project"}
        message={`This Project still has ${app.openToDoCount(id)} open To-do(s).`}
        onClose={close}
        options={[
          {
            title: "Complete all remaining",
            onPress: () => finish(finishing!, "complete"),
            testID: "remaining-complete",
          },
          {
            title: "Cancel all remaining",
            onPress: () => finish(finishing!, "cancel"),
            testID: "remaining-cancel",
          },
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
      <WhenPicker
        visible={dialog === "when"}
        current={project.startDate}
        allowEvening={false}
        onChoose={(when) => app.setProjectWhen(id, when)}
        onClose={close}
      />
      <DatePicker
        visible={dialog === "deadline"}
        title="Deadline"
        current={project.deadline}
        onChoose={(date) => app.setProjectDeadline(id, date)}
        onClose={close}
        testID="deadline-picker"
      />
      {dialog === "newHeading" ? (
        <PromptSheet
          title="New Heading"
          placeholder="Heading name"
          confirmTitle="Add"
          onSubmit={(t) => app.createHeading(id, t)}
          onClose={close}
        />
      ) : null}
      <MenuSheet
        visible={headingDialog?.action === "menu"}
        title={dialogHeading?.title}
        onClose={close}
        options={
          dialogHeading
            ? [
                {
                  title: "Rename",
                  onPress: () => setDialog({ heading: dialogHeading.id, action: "rename" }),
                  testID: "heading-rename",
                },
                {
                  title: app.canArchiveHeading(dialogHeading.id)
                    ? "Archive"
                    : "Archive (finish its To-dos first)",
                  disabled: !app.canArchiveHeading(dialogHeading.id),
                  onPress: () => app.archiveHeading(dialogHeading.id),
                  testID: "heading-archive",
                },
                {
                  title: "Delete…",
                  danger: true,
                  onPress: () => setDialog({ heading: dialogHeading.id, action: "delete" }),
                  testID: "heading-delete",
                },
              ]
            : []
        }
      />
      <MenuSheet
        visible={headingDialog?.action === "delete"}
        title={`Delete “${dialogHeading?.title ?? ""}”?`}
        message="What should happen to the To-dos under it?"
        onClose={close}
        options={
          dialogHeading
            ? [
                {
                  title: "Keep them in the Project",
                  onPress: () => app.deleteHeading(dialogHeading.id, { toDos: "keep" }),
                  testID: "heading-delete-keep",
                },
                {
                  title: "Move them to the Trash",
                  danger: true,
                  onPress: () => app.deleteHeading(dialogHeading.id, { toDos: "delete" }),
                  testID: "heading-delete-trash",
                },
              ]
            : []
        }
      />
      {headingDialog?.action === "rename" && dialogHeading ? (
        <PromptSheet
          title="Rename Heading"
          initial={dialogHeading.title}
          onSubmit={(t) => app.renameHeading(dialogHeading.id, t)}
          onClose={close}
        />
      ) : null}
      {headingDialog?.action === "add" && dialogHeading ? (
        <PromptSheet
          title={`New To-do in ${dialogHeading.title}`}
          placeholder="What do you need to do?"
          confirmTitle="Add"
          onSubmit={(t) => app.createToDo({ title: t, headingId: dialogHeading.id })}
          onClose={close}
        />
      ) : null}
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
  fields: { gap: 8, marginBottom: 16 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    marginHorizontal: 4,
  },
  headingTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
});
