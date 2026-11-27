import { StyleSheet, Text, View } from "react-native";
import type { NewToDo, ToDoEntry } from "../../core";
import { useNavigation, type BuiltInList } from "../navigation";
import { listTitles } from "../lists";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Empty } from "../components/Empty";
import { MagicPlus } from "../components/MagicPlus";
import { Screen } from "../components/Screen";
import { ToDoRow } from "../components/ToDoRow";

interface Section {
  key: string;
  title?: string;
  entries: ToDoEntry[];
}

function useSections(list: BuiltInList): Section[] {
  const app = useMyThings();
  switch (list) {
    case "inbox":
      return [{ key: "inbox", entries: app.inbox() }];
    case "today": {
      const { main, thisEvening } = app.today();
      return [
        { key: "main", entries: main },
        { key: "evening", title: "🌙 This Evening", entries: thisEvening },
      ];
    }
    default:
      return [];
  }
}

const placements: Partial<Record<BuiltInList, Omit<NewToDo, "title">>> = {
  today: { when: { kind: "today" } },
  someday: { when: { kind: "someday" } },
};

export function ListScreen({ list }: { list: BuiltInList }) {
  const theme = useTheme();
  const nav = useNavigation();
  const sections = useSections(list);
  const isEmpty = sections.every((s) => s.entries.length === 0);
  return (
    <View style={styles.fill}>
      <Screen title={listTitles[list]} testID={`screen-${list}`}>
        {isEmpty ? <Empty text="Nothing here" /> : null}
        {sections.map((section) =>
          section.entries.length === 0 ? null : (
            <View key={section.key} testID={`section-${section.key}`}>
              {section.title ? (
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>{section.title}</Text>
              ) : null}
              {section.entries.map((e) => (
                <ToDoRow
                  key={e.toDo.id}
                  entry={e}
                  onPress={() => nav.push({ name: "toDo", id: e.toDo.id })}
                />
              ))}
            </View>
          ),
        )}
      </Screen>
      <MagicPlus placement={placements[list] ?? {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 6, marginLeft: 8 },
});
