import { StyleSheet, Text, View } from "react-native";
import { addDays, daysBetween, startOfWeek, type UpcomingGroup } from "../../core";
import { Empty } from "../components/Empty";
import { MagicPlus } from "../components/MagicPlus";
import { Screen } from "../components/Screen";
import { ProjectRow } from "../components/ProjectRow";
import { useTagFilter } from "../components/TagFilter";
import { ToDoRow } from "../components/ToDoRow";
import { formatDate, formatMonth, formatRange } from "../format";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

function groupTitle(group: UpcomingGroup, today: string): string {
  switch (group.kind) {
    case "day":
      return formatDate(group.start, today);
    case "week": {
      const weekEnd = addDays(startOfWeek(group.start), 6);
      return formatRange(group.start, daysBetween(group.start, weekEnd) + 1);
    }
    case "month":
      return group.start.endsWith("-01")
        ? formatMonth(group.start)
        : `Rest of ${formatMonth(group.start)}`;
  }
}

export function UpcomingScreen() {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const filter = useTagFilter();
  const groups = app
    .upcoming()
    .map((g) => ({
      ...g,
      entries: g.entries.filter((e) =>
        e.kind === "toDo"
          ? app.filterByTags([e], filter.selected).length > 0
          : app.filterProjectsByTags([e.project], filter.selected).length > 0,
      ),
    }))
    .filter((g) => g.entries.length > 0);
  const today = app.currentDate();
  return (
    <View style={styles.fill}>
      <Screen title="Upcoming" testID="screen-upcoming" selectable header={filter.bar}>
        {groups.length === 0 ? <Empty text="Nothing scheduled" /> : null}
        {groups.map((group) => (
          <View key={`${group.kind}-${group.start}`} testID={`upcoming-${group.start}`}>
            <Text style={[styles.heading, { color: theme.text }]}>{groupTitle(group, today)}</Text>
            {group.entries.map((e) => (
              <View key={`${e.kind === "toDo" ? e.toDo.id : e.project.id}-${e.reason}`}>
                {e.reason === "deadline" ? (
                  <Text style={[styles.reason, { color: theme.warning }]}>
                    ⚑ Deadline {group.kind === "day" ? "" : formatDate(e.date, today)}
                  </Text>
                ) : group.kind !== "day" ? (
                  <Text style={[styles.reason, { color: theme.muted }]}>
                    {formatDate(e.date, today)}
                  </Text>
                ) : null}
                {e.kind === "toDo" ? (
                  <ToDoRow entry={e} onPress={() => nav.push({ name: "toDo", id: e.toDo.id })} />
                ) : (
                  <ProjectRow project={e.project} />
                )}
              </View>
            ))}
          </View>
        ))}
      </Screen>
      <MagicPlus placement={{ when: { kind: "date", date: app.tomorrow() } }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  heading: { fontSize: 17, fontWeight: "700", marginTop: 18, marginBottom: 6, marginLeft: 8 },
  reason: { fontSize: 12, marginLeft: 12, marginBottom: 2 },
});
