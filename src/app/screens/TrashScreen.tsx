import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { MenuSheet } from "../components/MenuSheet";
import { Screen } from "../components/Screen";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

export function TrashScreen() {
  const app = useMyThings();
  const theme = useTheme();
  const [confirm, setConfirm] = useState(false);
  const entries = app.trash();
  return (
    <Screen
      title="Trash"
      testID="screen-trash"
      actions={
        entries.length > 0 ? (
          <Button
            small
            kind="danger"
            title="Empty"
            onPress={() => setConfirm(true)}
            testID="empty-trash"
          />
        ) : null
      }
    >
      <Text style={[styles.note, { color: theme.muted }]}>
        To-dos and Projects are removed for good 30 days after they were deleted.
      </Text>
      {entries.length === 0 ? <Empty text="The Trash is empty" /> : null}
      {entries.map((e) => {
        const id = e.kind === "toDo" ? e.toDo.id : e.project.id;
        const title = e.kind === "toDo" ? e.toDo.title : e.project.title;
        const detail =
          e.kind === "project"
            ? `Project · ${e.toDoCount} To-do${e.toDoCount === 1 ? "" : "s"}`
            : e.parentTitle
              ? `↳ ${e.parentTitle}`
              : null;
        return (
          <View
            key={id}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
            testID={`trash-row-${id}`}
          >
            <View style={styles.body}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              {detail ? (
                <Text style={[styles.detail, { color: theme.muted }]}>{detail}</Text>
              ) : null}
            </View>
            <Button
              small
              title="Restore"
              onPress={() => (e.kind === "toDo" ? app.restore(id) : app.restoreProject(id))}
              testID={`restore-${id}`}
            />
          </View>
        );
      })}
      <MenuSheet
        visible={confirm}
        title="Empty the Trash?"
        message="Everything in the Trash will be removed for good. This can't be undone."
        onClose={() => setConfirm(false)}
        options={[
          {
            title: "Empty Trash",
            danger: true,
            onPress: () => app.emptyTrash(),
            testID: "empty-trash-confirm",
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, marginBottom: 8, marginLeft: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
    gap: 12,
  },
  body: { flex: 1 },
  title: { fontSize: 16 },
  detail: { fontSize: 12, marginTop: 2 },
});
