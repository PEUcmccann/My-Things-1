import type { ToDoEntry } from "../../core";
import { useNavigation } from "../navigation";
import { ToDoRow } from "./ToDoRow";

/** To-do rows that open the To-do's detail when tapped. */
export function ToDoList({ entries }: { entries: ToDoEntry[] }) {
  const nav = useNavigation();
  return (
    <>
      {entries.map((e) => (
        <ToDoRow
          key={e.toDo.id}
          entry={e}
          onPress={() => nav.push({ name: "toDo", id: e.toDo.id })}
        />
      ))}
    </>
  );
}
