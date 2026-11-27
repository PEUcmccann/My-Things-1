import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { MenuSheet } from "../components/MenuSheet";
import { PromptSheet } from "../components/PromptSheet";
import { Screen } from "../components/Screen";
import { SelectionBar } from "../components/SelectionBar";
import { SmartListEditor } from "../components/SmartListEditor";
import { ToDoList } from "../components/ToDoList";
import { useNavigation } from "../navigation";
import { useSelection } from "../selection";
import { smartListIcon } from "../smartListText";
import { useMyThings } from "../state";

type Dialog = "menu" | "edit" | "rename" | "delete" | null;

/** Smart Lists just created, whose screen opens with the filter editor the first time. */
const justCreated = new Set<string>();

/** Opens a new Smart List's editor the first time its screen shows (not on coming back). */
export function editOnFirstOpen(id: string): void {
  justCreated.add(id);
}

/**
 * The To-dos a Smart List matches, in one flat list. They can't be dragged: the
 * order is the shared list order.
 */
export function SmartListScreen({ id }: { id: string }) {
  const app = useMyThings();
  const nav = useNavigation();
  const selection = useSelection();
  const [dialog, setDialog] = useState<Dialog>(() => (justCreated.has(id) ? "edit" : null));
  useEffect(() => {
    justCreated.delete(id);
  }, [id]);
  const list = app.findSmartList(id);
  if (!list) {
    return (
      <Screen title="Smart List">
        <Empty text="This Smart List no longer exists." />
      </Screen>
    );
  }
  const entries = app.smartListToDos(id);
  const close = () => setDialog(null);
  return (
    <View style={styles.fill}>
      <Screen
        title={`${smartListIcon} ${list.title}`}
        testID="screen-smartList"
        selectable
        searchable
        actions={
          <Button small title="•••" onPress={() => setDialog("menu")} testID="smart-list-menu" />
        }
      >
        {entries.length === 0 ? <Empty text="Nothing matches" /> : null}
        <ToDoList entries={entries} />
      </Screen>
      {selection.active ? <SelectionBar /> : null}
      <MenuSheet
        visible={dialog === "menu"}
        title={list.title}
        onClose={close}
        options={[
          { title: "Edit filters", onPress: () => setDialog("edit"), testID: "smart-list-edit" },
          { title: "Rename", onPress: () => setDialog("rename"), testID: "smart-list-rename" },
          {
            title: "Delete Smart List…",
            danger: true,
            onPress: () => setDialog("delete"),
            testID: "smart-list-delete",
          },
        ]}
      />
      <MenuSheet
        visible={dialog === "delete"}
        title={`Delete “${list.title}”?`}
        message="Its To-dos stay where they are."
        onClose={close}
        options={[
          {
            title: "Delete Smart List",
            danger: true,
            onPress: () => {
              app.deleteSmartList(id);
              nav.back();
            },
            testID: "smart-list-delete-confirm",
          },
        ]}
      />
      {dialog === "edit" ? <SmartListEditor id={id} onClose={close} /> : null}
      {dialog === "rename" ? (
        <PromptSheet
          title="Rename Smart List"
          initial={list.title}
          onSubmit={(t) => app.renameSmartList(id, t)}
          onClose={close}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
