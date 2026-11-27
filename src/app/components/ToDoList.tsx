import { useEffect, useRef, useState, type ComponentRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
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

interface EdgeState {
  top: number;
  selection: ReturnType<typeof useSelection>;
}

/** Sliding a finger down the list's left edge selects each row it passes. */
function edgeResponder(
  container: { current: ComponentRef<typeof View> | null },
  layouts: Layouts,
  latest: { current: EdgeState },
) {
  const rowAt = (pageY: number) => {
    const y = pageY - latest.current.top;
    for (const [id, l] of layouts) if (y >= l.y && y <= l.y + l.h) return id;
    return null;
  };
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (_, g) => {
      container.current?.measureInWindow((_x, top) => {
        latest.current.top = top;
        const id = rowAt(g.y0);
        if (!latest.current.selection.active) latest.current.selection.start(id ?? undefined);
        else if (id) latest.current.selection.add(id);
      });
    },
    onPanResponderMove: (_, g) => {
      const id = rowAt(g.moveY);
      if (id) latest.current.selection.add(id);
    },
  });
}

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
  const latest = useRef<EdgeState>({ top: 0, selection });
  useEffect(() => {
    latest.current.selection = selection;
  });
  // The responder only reads refs while a gesture runs, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [edge] = useState(() => edgeResponder(ref, layouts, latest));
  const onRowLayout = (id: string, y: number, h: number) => layouts.set(id, { y, h });
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ minHeight: drag.dragging ? 48 : 0 }}
      testID={`droplist-${list.kind}`}
    >
      {children(key, onRowLayout)}
      <View
        {...edge.panHandlers}
        style={[styles.edge, selection.active && { backgroundColor: theme.border }]}
        testID="select-edge"
        accessibilityLabel="Slide to select"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { position: "absolute", left: -12, top: 0, bottom: 0, width: 14, borderRadius: 7 },
});
