import { View } from "react-native";
import type { ListRef, ToDoEntry } from "../../core";
import { toDoListDrop, useDrag, useDropList } from "../drag";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { ToDoRow } from "./ToDoRow";

interface Props {
  entries: ToDoEntry[];
  /** The list these rows are, so they can be reordered and dropped into. */
  list?: ListRef;
}

/** To-do rows that open the To-do's detail when tapped. */
export function ToDoList({ entries, list }: Props) {
  const nav = useNavigation();
  const rows = (listKey?: string) =>
    entries.map((e) => (
      <ToDoRow
        key={e.toDo.id}
        entry={e}
        listKey={listKey}
        onPress={() => nav.push({ name: "toDo", id: e.toDo.id })}
      />
    ));
  if (!list) return <>{rows()}</>;
  return <DropList list={list}>{rows}</DropList>;
}

function DropList({
  list,
  children,
}: {
  list: ListRef;
  children: (listKey: string) => React.ReactNode;
}) {
  const app = useMyThings();
  const drag = useDrag();
  const key = `list:${JSON.stringify(list)}`;
  const ref = useDropList(key, toDoListDrop(app, drag, list));
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ minHeight: drag.dragging ? 48 : 0 }}
      testID={`droplist-${list.kind}`}
    >
      {children(key)}
    </View>
  );
}
