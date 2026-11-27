import { View } from "react-native";
import type { BuiltInList } from "../navigation";
import { listTitles } from "../lists";
import { useMyThings } from "../state";
import { Empty } from "../components/Empty";
import { MagicPlus } from "../components/MagicPlus";
import { Screen } from "../components/Screen";
import { ToDoRow } from "../components/ToDoRow";

export function ListScreen({ list }: { list: BuiltInList }) {
  const app = useMyThings();
  const entries = list === "inbox" ? app.inbox() : [];
  return (
    <View style={{ flex: 1 }}>
      <Screen title={listTitles[list]} testID={`screen-${list}`}>
        {entries.length === 0 ? <Empty text="Nothing here" /> : null}
        {entries.map((e) => (
          <ToDoRow key={e.toDo.id} entry={e} />
        ))}
      </Screen>
      <MagicPlus placement={{}} />
    </View>
  );
}
