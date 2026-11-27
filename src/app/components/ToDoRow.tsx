import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ToDo, ToDoEntry } from "../../core";
import { useDrag, useDragHandle, useDropRow } from "../drag";
import { useFinishToDo } from "../finish";
import { useSelection } from "../selection";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Checkbox } from "./Checkbox";
import { DateBadges } from "./DateBadges";
import { MenuSheet } from "./MenuSheet";
import { MovePicker } from "./MovePicker";
import { TagChips } from "./TagChips";
import { WhenPicker } from "./WhenPicker";

/** Small hints on a row: notes, and Checklist progress such as 2/5. */
function Indicators({ toDoId, hasNotes }: { toDoId: string; hasNotes: boolean }) {
  const app = useMyThings();
  const theme = useTheme();
  const { ticked, total } = app.checklistProgress(toDoId);
  if (!hasNotes && total === 0) return null;
  return (
    <View style={styles.indicators}>
      {hasNotes ? (
        <Text style={[styles.indicator, { color: theme.muted }]} testID="row-notes">
          📝
        </Text>
      ) : null}
      {total > 0 ? (
        <Text style={[styles.indicator, { color: theme.muted }]} testID="row-checklist">
          ☑ {ticked}/{total}
        </Text>
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

function DragHandle({ toDo }: { toDo: ToDo }) {
  const theme = useTheme();
  const handlers = useDragHandle({
    kind: "toDo",
    id: toDo.id,
    title: toDo.title,
    isSubToDo: toDo.parentId !== null,
  });
  return (
    <View
      {...handlers}
      style={styles.handle}
      testID={`drag-${toDo.id}`}
      accessibilityLabel="Drag to move"
    >
      <Text style={[styles.handleText, { color: theme.muted }]}>≡</Text>
    </View>
  );
}

/** How far a row must be swiped to trigger its action. */
const swipeDistance = 70;

type Swipe = {
  right: () => void;
  left: () => void;
  enabled: () => boolean;
  /** Set while swiping, so the tap the browser sends on release is ignored. */
  swipedAt: number;
};

function swipeResponder(offset: Animated.Value, latest: { current: Swipe }) {
  return PanResponder.create({
    // Capture, so a horizontal swipe wins over the row's own press.
    onMoveShouldSetPanResponderCapture: (_, g) =>
      latest.current.enabled() && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      latest.current.swipedAt = Date.now();
    },
    onPanResponderMove: (_, g) => offset.setValue(Math.max(-120, Math.min(120, g.dx))),
    onPanResponderRelease: (_, g) => {
      latest.current.swipedAt = Date.now();
      Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start();
      if (g.dx > swipeDistance) latest.current.right();
      else if (g.dx < -swipeDistance) latest.current.left();
    },
    onPanResponderTerminate: () =>
      Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start(),
  });
}

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
  const latest = useRef<Swipe>({
    right: () => {},
    left: () => {},
    enabled: () => false,
    swipedAt: 0,
  });
  useEffect(() => {
    latest.current = {
      ...latest.current,
      right: () => setDialog("when"),
      left: () => (selection.active ? selection.toggle(toDo.id) : selection.start(toDo.id)),
      enabled: () => !drag.dragging,
    };
  });
  // The responder only reads `latest` while a gesture runs, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [swipe] = useState(() => swipeResponder(offset, latest));

  return (
    <View ref={ref} collapsable={false} style={lifted && styles.lifted}>
      <View style={[styles.under, { backgroundColor: theme.border }]} pointerEvents="none">
        <Text style={{ color: theme.accent }}>📅 When</Text>
        <Text style={{ color: theme.accent }}>Select ☑</Text>
      </View>
      <Animated.View {...swipe.panHandlers} style={{ transform: [{ translateX: offset }] }}>
        <Pressable
          onPress={() => {
            if (Date.now() - latest.current.swipedAt < 400) return;
            if (selection.active) selection.toggle(toDo.id);
            else onPress?.();
          }}
          style={[
            styles.row,
            { backgroundColor: theme.surface, borderColor: selected ? theme.accent : theme.border },
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
            <DateBadges item={toDo} />
            <Indicators toDoId={toDo.id} hasNotes={toDo.notes.trim().length > 0} />
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
              <Text style={{ color: theme.muted, fontSize: 18 }}>⋯</Text>
            </Pressable>
          ) : null}
          {listKey && !selection.active ? <DragHandle toDo={toDo} /> : null}
        </Pressable>
      </Animated.View>
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
    // A mouse swipe on the web would otherwise select text and cancel the gesture.
    userSelect: "none",
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
  handleText: { fontSize: 20 },
  indicators: { flexDirection: "row", gap: 10, marginTop: 3 },
  indicator: { fontSize: 12 },
});
