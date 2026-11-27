import { StyleSheet, Text, View } from "react-native";
import type { ListRef, NewToDo, ToDoEntry } from "../../core";
import { useDrag } from "../drag";
import { type BuiltInList } from "../navigation";
import { listIcons, listTitles } from "../lists";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Empty } from "../components/Empty";
import { Icon, type IconName } from "../components/Icon";
import { MagicPlus } from "../components/MagicPlus";
import { Screen } from "../components/Screen";
import { ProjectRow } from "../components/ProjectRow";
import { useTagFilter } from "../components/TagFilter";
import { ToDoList } from "../components/ToDoList";

interface Section {
  key: string;
  title?: string;
  icon?: IconName;
  entries: ToDoEntry[];
  list: ListRef;
}

function useSections(list: BuiltInList): Section[] {
  const app = useMyThings();
  switch (list) {
    case "inbox":
      return [{ key: "inbox", entries: app.inbox(), list: { kind: "inbox" } }];
    case "today": {
      const { main, thisEvening } = app.today();
      return [
        { key: "main", entries: main, list: { kind: "today", part: "main" } },
        {
          key: "evening",
          title: "This Evening",
          icon: "evening",
          entries: thisEvening,
          list: { kind: "today", part: "thisEvening" },
        },
      ];
    }
    case "anytime":
      return [{ key: "anytime", entries: app.anytime(), list: { kind: "anytime" } }];
    case "someday":
      return [{ key: "someday", entries: app.someday(), list: { kind: "someday" } }];
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
  const drag = useDrag();
  const app = useMyThings();
  const filter = useTagFilter();
  const sections = useSections(list).map((s) => ({
    ...s,
    entries: app.filterByTags(s.entries, filter.selected),
  }));
  const projects = app.filterProjectsByTags(
    list === "today" || list === "anytime" || list === "someday" ? app.projectsIn(list) : [],
    filter.selected,
  );
  const isEmpty = projects.length === 0 && sections.every((s) => s.entries.length === 0);
  return (
    <View style={styles.fill}>
      <Screen
        title={listTitles[list]}
        icon={listIcons[list]}
        testID={`screen-${list}`}
        selectable
        searchable
        header={filter.bar}
      >
        {isEmpty ? <Empty text="Nothing here" /> : null}
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
        {sections.map((section) =>
          // An empty part stays as somewhere to drop while dragging.
          section.entries.length === 0 && !drag.dragging ? null : (
            <View key={section.key} testID={`section-${section.key}`}>
              {section.title ? (
                <View style={styles.sectionHeader}>
                  {section.icon ? <Icon name={section.icon} size={14} color={theme.muted} /> : null}
                  <Text style={[styles.sectionTitle, { color: theme.muted }]}>{section.title}</Text>
                </View>
              ) : null}
              <ToDoList entries={section.entries} list={section.list} />
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600" },
});
