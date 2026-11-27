import { useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import type { ToDo, ToDoEntry } from "../../core";
import { DragHandle, useDrag, useDropRow } from "../drag";
import { useFinishToDo } from "../finish";
import { useSelection } from "../selection";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Checkbox } from "./Checkbox";
import { DateBadges } from "./DateBadges";
import { Icon } from "./Icon";
import { MenuSheet } from "./MenuSheet";
import { MovePicker } from "./MovePicker";
import { TagChips } from "./TagChips";
import { WhenPicker } from "./WhenPicker";

/** Small hints on a row: repeating, notes, and Checklist progress such as 2/5. */
function Indicators({
  toDoId,
  hasNotes,
  repeats,
}: {
  toDoId: string;
  hasNotes: boolean;
  repeats: boolean;
}) {
  const app = useMyThings();
  const theme = useTheme();
  const { ticked, total } = app.checklistProgress(toDoId);
  if (!hasNotes && total === 0 && !repeats) return null;
  return (
    <View style={styles.indicators}>
      {repeats ? (
        <View testID="row-repeat" accessibilityLabel="Repeating">
          <Icon name="repeat" size={13} color={theme.muted} />
        </View>
      ) : null}
      {hasNotes ? (
        <View testID="row-notes" accessibilityLabel="Has notes">
          <Icon name="notes" size={13} color={theme.muted} />
        </View>
      ) : null}
      {total > 0 ? (
        <View style={styles.indicator}>
          <Icon name="checklist" size={13} color={theme.muted} />
          <Text style={[styles.indicatorText, { color: theme.muted }]} testID="row-checklist">
            {ticked}/{total}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface Props {
  entry: ToDoEntry;
  onPress?: () => void;
  /** The drop list this row belongs to; rows in one can be dragged to reorder. */
  listKey?: string;
}

function RowHandle({ toDo }: { toDo: ToDo }) {
  const theme = useTheme();
  return (
    <DragHandle
      item={{ kind: "toDo", id: toDo.id, title: toDo.title, isSubToDo: toDo.parentId !== null }}
      style={styles.handle}
      testID={`drag-${toDo.id}`}
      accessibilityLabel="Drag to move"
    >
      <Icon name="drag" size={20} color={theme.muted} />
    </DragHandle>
  );
}

/** How far a row must be swiped to trigger its action. */
const swipeDistance = 70;

type Dialog = "menu" | "when" | "move" | null;

export function ToDoRow({ entry, onPress, listKey }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const finish = useFinishToDo();
  const selection = useSelection();
  const { toDo, parentTitle } = entry;
  const ref = useDropRow(listKey, toDo.id);
  const drag = useDrag();
  const [dialog, setDialog] = useState<Dialog>(null);
  const lifted = drag.dragging?.kind === "toDo" && drag.dragging.id === toDo.id;
  const finished = toDo.outcome !== "active";
  const selected = selection.active && selection.isSelected(toDo.id);
  const toggle = () => (finished ? app.reopen(toDo.id) : finish(toDo.id, "completed"));

  // Swipe right for "When", swipe left to start selecting.
  const [offset] = useState(() => new Animated.Value(0));
  const springBack = () => Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start();
  // On the web the click after a swipe still reaches the row, so it is ignored.
  // (On phones, gesture-handler cancels the press itself.)
  const swiped = useRef(false);
  const swipe = usePanGesture({
    enabled: !drag.dragging,
    // Horizontal only, so a vertical move still scrolls the list.
    activeOffsetX: [-5, 5],
    failOffsetY: [-10, 10],
    onBegin: () => {
      swiped.current = false;
    },
    onActivate: () => {
      swiped.current = true;
    },
    onUpdate: (e) => offset.setValue(Math.max(-120, Math.min(120, e.translationX))),
    onDeactivate: (e) => {
      springBack();
      if (e.canceled) return;
      if (e.translationX > swipeDistance) setDialog("when");
      else if (e.translationX < -swipeDistance) {
        if (selection.active) selection.toggle(toDo.id);
        else selection.start(toDo.id);
      }
    },
  });

  return (
    <View ref={ref} collapsable={false} style={lifted && styles.lifted}>
      <View style={[styles.under, { backgroundColor: theme.border }]} pointerEvents="none">
        <View style={styles.swipeAction}>
          <Icon name="when" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent }}>When</Text>
        </View>
        <View style={styles.swipeAction}>
          <Text style={{ color: theme.accent }}>Select</Text>
          <Icon name="select" size={16} color={theme.accent} />
        </View>
      </View>
      <GestureDetector gesture={swipe} touchAction="pan-y">
        <Animated.View style={{ transform: [{ translateX: offset }] }}>
          <Pressable
            onPress={() => {
              if (swiped.current) return;
              if (selection.active) selection.toggle(toDo.id);
              else onPress?.();
            }}
            style={[
              styles.row,
              {
                backgroundColor: theme.surface,
                borderColor: selected ? theme.accent : theme.border,
              },
              selected && styles.selected,
            ]}
            testID={`todo-row-${toDo.id}`}
            aria-selected={selected}
          >
            {selection.active ? (
              <View
                style={[
                  styles.selectDot,
                  { borderColor: theme.accent },
                  selected && { backgroundColor: theme.accent },
                ]}
                testID={`todo-select-${toDo.id}`}
              >
                {selected ? <Text style={{ color: theme.onAccent, fontSize: 12 }}>✓</Text> : null}
              </View>
            ) : (
              <Checkbox outcome={toDo.outcome} onPress={toggle} testID={`todo-check-${toDo.id}`} />
            )}
            <View style={styles.body}>
              {parentTitle ? (
                <Text style={[styles.parent, { color: theme.muted }]} numberOfLines={1}>
                  ↳ {parentTitle}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.title,
                  { color: finished ? theme.muted : theme.text },
                  finished && styles.struck,
                ]}
                numberOfLines={2}
                testID={finished ? `finished-${toDo.outcome}` : undefined}
              >
                {toDo.title}
              </Text>
              <DateBadges item={toDo} planning={toDo} />
              <Indicators
                toDoId={toDo.id}
                hasNotes={toDo.notes.trim().length > 0}
                repeats={toDo.repeat !== null}
              />
              <TagChips tags={app.tagsOf({ kind: "toDo", id: toDo.id })} />
            </View>
            {Platform.OS === "web" && !selection.active ? (
              <Pressable
                onPress={() => setDialog("menu")}
                hitSlop={8}
                style={styles.menuButton}
                testID={`todo-menu-${toDo.id}`}
                accessibilityLabel="More actions"
              >
                <Icon name="more" size={20} color={theme.muted} />
              </Pressable>
            ) : null}
            {listKey && !selection.active ? <RowHandle toDo={toDo} /> : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
      <MenuSheet
        visible={dialog === "menu"}
        title={toDo.title}
        onClose={() => setDialog(null)}
        options={[
          { title: "When…", onPress: () => setDialog("when"), testID: "row-when" },
          { title: "Select", onPress: () => selection.start(toDo.id), testID: "row-select" },
          ...(toDo.parentId
            ? []
            : [{ title: "Move…", onPress: () => setDialog("move"), testID: "row-move" }]),
          {
            title: "Delete",
            danger: true,
            onPress: () => app.delete(toDo.id),
            testID: "row-delete",
          },
        ]}
      />
      <WhenPicker
        visible={dialog === "when"}
        current={toDo.startDate}
        allowUndated={!toDo.repeat}
        onChoose={(when) => app.setWhen(toDo.id, when)}
        onClose={() => setDialog(null)}
      />
      <MovePicker
        visible={dialog === "move"}
        onChoose={(to) => app.moveToDo(toDo.id, to)}
        onClose={() => setDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
    gap: 12,
  },
  body: { flex: 1 },
  parent: { fontSize: 12, marginBottom: 2 },
  title: { fontSize: 16 },
  struck: { textDecorationLine: "line-through" },
  lifted: { opacity: 0.4 },
  selected: { borderWidth: 1.5 },
  under: {
    ...StyleSheet.absoluteFill,
    bottom: 6,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  selectDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: { paddingHorizontal: 4 },
  handle: { paddingHorizontal: 6, paddingVertical: 8, marginRight: -6 },
  indicators: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 3 },
  indicator: { flexDirection: "row", alignItems: "center", gap: 3 },
  indicatorText: { fontSize: 12 },
  swipeAction: { flexDirection: "row", alignItems: "center", gap: 6 },
});
