import { useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, TextInput, View } from "react-native";
import type { NewToDo } from "../../core";
import { useDrag, useManualDrag, type NewToDoSpot } from "../drag";
import { haptics } from "../haptics";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface Props {
  /** Where a new To-do is filed, based on the screen it was created from. */
  placement: Omit<NewToDo, "title">;
}

/** How far a press must move before it becomes a drag. */
const dragDistance = 8;

type Manual = ReturnType<typeof useManualDrag>;

function plusResponder(latest: { current: { manual: Manual; tap: () => void } }) {
  let dragging = false;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      dragging = false;
    },
    onPanResponderMove: (_, g) => {
      if (!dragging && Math.hypot(g.dx, g.dy) > dragDistance) {
        dragging = true;
        latest.current.manual.start({ kind: "new" }, g.moveX, g.moveY);
      }
      if (dragging) latest.current.manual.move(g.moveX, g.moveY);
    },
    onPanResponderRelease: () => {
      if (dragging) latest.current.manual.finish();
      else latest.current.tap();
      dragging = false;
    },
    onPanResponderTerminate: () => {
      if (dragging) latest.current.manual.cancel();
      dragging = false;
    },
  });
}

/**
 * The add button shown on every list. Tap it to add a To-do here, or drag it to
 * a spot in the list, onto the Inbox, a Project or a Heading to create it there.
 */
export function MagicPlus({ placement }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const drag = useDrag();
  const manual = useManualDrag();
  const [spot, setSpot] = useState<NewToDoSpot | null>(null);
  const [title, setTitle] = useState("");

  const latest = useRef({ manual, tap: () => setSpot({ placement }) });
  useEffect(() => {
    latest.current = { manual, tap: () => setSpot({ placement }) };
  });
  // The responder only reads `latest` while a gesture runs, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => plusResponder(latest));

  useEffect(() => {
    drag.setNewToDoOpener(setSpot);
    return () => drag.setNewToDoOpener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag.setNewToDoOpener]);

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
      <View
        {...responder.panHandlers}
        style={[styles.fab, { backgroundColor: theme.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Add To-do"
        testID="magic-plus"
      >
        <Text style={[styles.plus, { color: theme.onAccent }]}>+</Text>
      </View>
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
