import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from "react-native-gesture-handler";
import type { NewToDo } from "../../core";
import { useDrag, useManualDrag, type NewToDoSpot } from "../drag";
import { haptics } from "../haptics";
import { followEdit, tokenHint } from "../quickEntry";
import { useSelection } from "../selection";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Icon } from "./Icon";
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
  // Offsets of shorthand tapped away, kept in the title as plain text.
  const [ignored, setIgnored] = useState<number[]>([]);

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
    setIgnored([]);
  };
  const changeTitle = (next: string) => {
    setIgnored((offsets) => followEdit(offsets, title, next));
    setTitle(next);
  };
  const add = () => {
    if (!spot) return;
    const id = app.createFromQuickEntry(title, { placement: spot.placement, at: spot.at, ignored });
    if (!id) return;
    haptics.success();
    close();
  };
  const preview = spot ? app.previewQuickEntry(title, ignored) : null;
  const today = app.currentDate();

  return (
    <>
      <GestureDetector gesture={gesture}>
        <View
          style={[styles.fab, { backgroundColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Add To-do"
          testID="magic-plus"
        >
          <Icon name="add" size={30} color={theme.onAccent} />
        </View>
      </GestureDetector>
      <Sheet visible={spot !== null} onClose={close} testID="new-todo-sheet">
        <Text style={[styles.heading, { color: theme.text }]}>New To-do</Text>
        <TextInput
          value={title}
          onChangeText={changeTitle}
          placeholder="What do you need to do?"
          placeholderTextColor={theme.muted}
          autoFocus
          onSubmitEditing={add}
          returnKeyType="done"
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          testID="new-todo-title"
        />
        {preview && preview.tokens.length > 0 && (
          <View style={styles.tokens} testID="quick-entry-tokens">
            {preview.tokens.map((t) => {
              const hint = tokenHint(t.value, today);
              return (
                <Pressable
                  key={t.start}
                  onPress={() => setIgnored((offsets) => [...offsets, t.start])}
                  style={[styles.token, { backgroundColor: theme.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Keep ${t.text} in the title`}
                  testID={`quick-entry-token-${t.start}`}
                >
                  {hint && <Icon name={hint.icon} size={14} color={theme.onAccent} />}
                  <Text style={[styles.tokenText, { color: theme.onAccent }]}>
                    {t.text}
                    {t.newTag ? " (new)" : ""}
                    {hint ? ` · ${hint.text}` : ""} ×
                  </Text>
                </Pressable>
              );
            })}
            <Text style={[styles.cleaned, { color: theme.muted }]} testID="quick-entry-title">
              {preview.title || "Add a title"}
            </Text>
          </View>
        )}
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
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 10, padding: 12 },
  tokens: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 },
  token: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tokenText: { fontSize: 14, fontWeight: "600" },
  cleaned: { fontSize: 14, flexBasis: "100%", marginTop: 2 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
});
