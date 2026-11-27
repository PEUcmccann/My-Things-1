import { StyleSheet, Text, View } from "react-native";
import { formatEstimate, type ListRef, type NewToDo, type ToDoEntry } from "../../core";
import { useDrag } from "../drag";
import { type BuiltInList } from "../navigation";
import { listTitles } from "../lists";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { useTodayView, type TodayView } from "../todayView";
import { DayTimeline } from "../components/DayTimeline";
import { Empty } from "../components/Empty";
import { MagicPlus } from "../components/MagicPlus";
import { Screen } from "../components/Screen";
import { ProjectRow } from "../components/ProjectRow";
import { Segmented } from "../components/Segmented";
import { useTagFilter } from "../components/TagFilter";
import { ToDoList } from "../components/ToDoList";

interface Section {
  key: string;
  title?: string;
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
          title: "🌙 This Evening",
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

const todayViews: { value: TodayView; title: string }[] = [
  { value: "list", title: "List" },
  { value: "timeline", title: "Timeline" },
];

export function ListScreen({ list }: { list: BuiltInList }) {
  const theme = useTheme();
  const drag = useDrag();
  const app = useMyThings();
  const filter = useTagFilter();
  const today = useTodayView();
  const timeline = list === "today" && today.view === "timeline";
  const sections = useSections(list).map((s) => ({
    ...s,
    entries: app.filterByTags(s.entries, filter.selected),
  }));
  const projects = app.filterProjectsByTags(
    list === "today" || list === "anytime" || list === "someday" ? app.projectsIn(list) : [],
    filter.selected,
  );
  const estimate = list === "today" ? app.todayEstimate() : 0;
  const isEmpty = projects.length === 0 && sections.every((s) => s.entries.length === 0);
  return (
    <View style={styles.fill}>
      <Screen
        title={listTitles[list]}
        testID={`screen-${list}`}
        selectable={!timeline}
        searchable
        scrolls={!timeline}
        header={
          <>
            {estimate > 0 ? (
              <Text style={[styles.estimate, { color: theme.muted }]} testID="today-estimate">
                Estimated {formatEstimate(estimate)}
              </Text>
            ) : null}
            {list === "today" ? (
              <Segmented
                options={todayViews}
                value={today.view}
                onChange={today.setView}
                testID="today-view"
              />
            ) : null}
            {timeline ? null : filter.bar}
          </>
        }
      >
        {timeline ? <DayTimeline /> : null}
        {!timeline && isEmpty ? <Empty text="Nothing here" /> : null}
        {(timeline ? [] : projects).map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
        {sections.map((section) =>
          // An empty part stays as somewhere to drop while dragging.
          timeline || (section.entries.length === 0 && !drag.dragging) ? null : (
            <View key={section.key} testID={`section-${section.key}`}>
              {section.title ? (
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>{section.title}</Text>
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
  estimate: { fontSize: 14, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 6, marginLeft: 8 },
});
