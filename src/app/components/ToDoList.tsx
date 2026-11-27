import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import type { ListRef, ToDoEntry } from "../../core";
import { toDoListDrop, useDrag, useDropList } from "../drag";
import { useNavigation } from "../navigation";
import { useSelection } from "../selection";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { ToDoRow } from "./ToDoRow";

interface Props {
  entries: ToDoEntry[];
  /** The list these rows are, so they can be reordered and dropped into. */
  list?: ListRef;
}

/** To-do rows that open the To-do's detail when tapped. */
export function ToDoList({ entries, list }: Props) {
  const nav = useNavigation();
  const rows = (listKey?: string, onRowLayout?: (id: string, y: number, h: number) => void) =>
    entries.map((e) => (
      <View
        key={e.toDo.id}
        onLayout={
          onRowLayout
            ? (ev) => onRowLayout(e.toDo.id, ev.nativeEvent.layout.y, ev.nativeEvent.layout.height)
            : undefined
        }
      >
        <ToDoRow
          entry={e}
          listKey={listKey}
          onPress={() => nav.push({ name: "toDo", id: e.toDo.id })}
        />
      </View>
    ));
  if (!list) return <>{rows()}</>;
  return <DropList list={list}>{rows}</DropList>;
}

type Layouts = Map<string, { y: number; h: number }>;

function DropList({
  list,
  children,
}: {
  list: ListRef;
  children: (
    listKey: string,
    onRowLayout: (id: string, y: number, h: number) => void,
  ) => React.ReactNode;
}) {
  const app = useMyThings();
  const drag = useDrag();
  const theme = useTheme();
  const selection = useSelection();
  const key = `list:${JSON.stringify(list)}`;
  const ref = useDropList(key, toDoListDrop(app, drag, list));
  const [layouts] = useState<Layouts>(() => new Map());
  const [top] = useState({ y: 0 });
  const rowAt = (y: number) => {
    const inList = y - top.y;
    for (const [id, l] of layouts) if (inList >= l.y && inList <= l.y + l.h) return id;
    return null;
  };
  // Sliding a finger down the list's left edge selects each row it passes.
  const edge = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      const y = e.absoluteY;
      ref.current?.measureInWindow((_x, listTop) => {
        top.y = listTop;
        const id = rowAt(y);
        if (!selection.active) selection.start(id ?? undefined);
        else if (id) selection.add(id);
      });
    },
    onUpdate: (e) => {
      const id = rowAt(e.absoluteY);
      if (id) selection.add(id);
    },
  });
  const onRowLayout = (id: string, y: number, h: number) => layouts.set(id, { y, h });
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ minHeight: drag.dragging ? 48 : 0 }}
      testID={`droplist-${list.kind}`}
    >
      {children(key, onRowLayout)}
      <GestureDetector gesture={edge}>
        <View
          style={[styles.edge, selection.active && { backgroundColor: theme.border }]}
          testID="select-edge"
          accessibilityLabel="Slide to select"
        />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { position: "absolute", left: -12, top: 0, bottom: 0, width: 14, borderRadius: 7 },
});
