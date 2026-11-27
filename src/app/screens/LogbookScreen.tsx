import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { Screen } from "../components/Screen";
import { ProjectRow } from "../components/ProjectRow";
import { useTagFilter } from "../components/TagFilter";
import { ToDoRow } from "../components/ToDoRow";
import { formatDate } from "../format";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

export function LogbookScreen() {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const filter = useTagFilter();
  const days = app
    .logbook()
    .map((d) => ({
      ...d,
      entries: d.entries.filter((e) => app.entryHasTags(e, filter.selected)),
    }))
    .filter((d) => d.entries.length > 0);
  const today = app.currentDate();
  const showMove = app.logbookMode() !== "immediately" && app.hasFinishedOutsideLogbook();
  return (
    <Screen
      title="Logbook"
      icon="logbook"
      testID="screen-logbook"
      searchable
      header={filter.bar}
      actions={
        showMove ? (
          <Button
            small
            title="Move to Logbook"
            onPress={() => app.moveFinishedToLogbook()}
            testID="log-finished"
          />
        ) : null
      }
    >
      {days.length === 0 ? (
        <Empty text="Completed and Cancelled To-dos and Projects appear here" />
      ) : null}
      {days.map((day) => (
        <View key={day.date} testID={`logbook-day-${day.date}`}>
          <Text style={[styles.day, { color: theme.muted }]}>{formatDate(day.date, today)}</Text>
          {day.entries.map((e) =>
            e.kind === "toDo" ? (
              <ToDoRow
                key={e.toDo.id}
                entry={e}
                onPress={() => nav.push({ name: "toDo", id: e.toDo.id })}
              />
            ) : (
              <ProjectRow key={e.project.id} project={e.project} />
            ),
          )}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 6, marginLeft: 8 },
});
