import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from "react-native-gesture-handler";
import type { NewToDo } from "../../core";
import { useDrag, useManualDrag, type NewToDoSpot } from "../drag";
import { haptics } from "../haptics";
import { useSelection } from "../selection";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { SelectionBar } from "./SelectionBar";
import { Sheet } from "./Sheet";

interface Props {
  /** Where a new To-do is filed, based on the screen it was created from. */
  placement: Omit<NewToDo, "title">;
}

/** How far a press must move before it becomes a drag. */
const dragDistance = 8;

/**
 * The add button shown on every list. Tap it to add a To-do here, or drag it to
 * a spot in the list, onto the Inbox, a Project or a Heading to create it there.
 */
export function MagicPlus({ placement }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const drag = useDrag();
  const manual = useManualDrag();
  const selection = useSelection();
  const [spot, setSpot] = useState<NewToDoSpot | null>(null);
  const [title, setTitle] = useState("");

  // Tap to add here; once a press moves, it becomes a drag.
  const tap = useTapGesture({
    maxDistance: dragDistance,
    maxDuration: 60_000,
    onActivate: () => setSpot({ placement }),
  });
  const pan = usePanGesture({
    minDistance: dragDistance,
    onActivate: (e) => manual.start({ kind: "new" }, e.absoluteX, e.absoluteY),
    onUpdate: (e) => manual.move(e.absoluteX, e.absoluteY),
    onDeactivate: (e) => (e.canceled ? manual.cancel() : manual.finish()),
  });
  const gesture = useCompetingGestures(pan, tap);

  useEffect(() => {
    drag.setNewToDoOpener(setSpot);
    return () => drag.setNewToDoOpener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag.setNewToDoOpener]);

  if (selection.active) return <SelectionBar />;

  const close = () => {
    setSpot(null);
    setTitle("");
  };
  const add = () => {
    const trimmed = title.trim();
    if (!trimmed || !spot) return;
    app.createToDo({ ...spot.placement, title: trimmed, at: spot.at });
    haptics.success();
    close();
  };

  return (
    <>
      <GestureDetector gesture={gesture}>
        <View
          style={[styles.fab, { backgroundColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Add To-do"
          testID="magic-plus"
        >
          <Text style={[styles.plus, { color: theme.onAccent }]}>+</Text>
        </View>
      </GestureDetector>
      <Sheet visible={spot !== null} onClose={close} testID="new-todo-sheet">
        <Text style={[styles.heading, { color: theme.text }]}>New To-do</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What do you need to do?"
          placeholderTextColor={theme.muted}
          autoFocus
          onSubmitEditing={add}
          returnKeyType="done"
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          testID="new-todo-title"
        />
        <View style={styles.buttons}>
          <Button title="Cancel" onPress={close} />
          <Button title="Add" kind="primary" onPress={add} testID="new-todo-add" />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  plus: { fontSize: 34, lineHeight: 38, fontWeight: "300" },
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 10, padding: 12 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
});
