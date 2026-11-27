import { StyleSheet, Text, View } from "react-native";
import { formatEstimate, type ToDo } from "../../core";
import { energyNames, formatDate, priorityMarks, timeSlotText } from "../format";
import { useMyThings } from "../state";
import { useTheme, type Theme } from "../theme";

/** The dates of a To-do or Project. Projects have no This Evening or Time slot. */
type Dated = Pick<ToDo, "startDate" | "deadline"> & {
  evening?: boolean;
  timeSlot?: ToDo["timeSlot"];
};

/** A To-do's planning attributes. Projects have none. */
type Planned = Pick<ToDo, "priority" | "energy" | "estimate">;

const priorityColour = (theme: Theme, priority: ToDo["priority"]) =>
  priority === "high" ? theme.danger : priority === "medium" ? theme.warning : theme.muted;

/**
 * The badge line on a list row: Priority, Start date or Time slot, Deadline,
 * Energy and Estimate, each only when set.
 */
export function DateBadges({
  item: toDo,
  planning,
  showStart = true,
}: {
  item: Dated;
  planning?: Planned;
  showStart?: boolean;
}) {
  const app = useMyThings();
  const theme = useTheme();
  const today = app.currentDate();
  const flag = app.deadlineFlag(toDo.deadline);
  const startsLater = toDo.startDate !== null && toDo.startDate > today;
  // A slot on another day shows that day with it, so the date isn't shown twice.
  const slot = timeSlotText(
    { startDate: toDo.startDate, timeSlot: toDo.timeSlot ?? null },
    today,
    showStart,
  );
  const slotToday = toDo.startDate === today;
  const priority = planning && planning.priority !== "none" ? planning.priority : null;
  const energy = planning?.energy ?? null;
  const estimate = planning?.estimate ?? null;
  const hasDates = toDo.deadline || slot || (showStart && (startsLater || toDo.evening));
  if (!hasDates && !priority && !energy && !estimate) return null;
  return (
    <View style={styles.row}>
      {priority ? (
        <Text
          style={[styles.badge, styles.priority, { color: priorityColour(theme, priority) }]}
          testID="badge-priority"
          accessibilityLabel={`${priority} Priority`}
        >
          {priorityMarks[priority]}
        </Text>
      ) : null}
      {showStart && toDo.evening ? (
        <Text style={[styles.badge, { color: theme.muted }]}>🌙 This Evening</Text>
      ) : null}
      {slot ? (
        <Text
          style={[
            styles.badge,
            slotToday && styles.slotToday,
            { color: slotToday ? theme.text : theme.muted },
          ]}
          testID="row-time-slot"
        >
          {slot}
        </Text>
      ) : showStart && startsLater ? (
        <Text style={[styles.badge, { color: theme.muted }]}>
          {formatDate(toDo.startDate!, today)}
        </Text>
      ) : null}
      {toDo.deadline ? (
        <Text
          style={[
            styles.badge,
            { color: flag === "overdue" ? theme.danger : flag ? theme.warning : theme.muted },
          ]}
          testID={flag ? `deadline-flag-${flag}` : undefined}
        >
          {flag ? "⚑ " : ""}
          Deadline {formatDate(toDo.deadline, today)}
        </Text>
      ) : null}
      {energy ? (
        <Text style={[styles.badge, { color: theme.muted }]} testID="badge-energy">
          {energyNames[energy]}
        </Text>
      ) : null}
      {estimate ? (
        <Text style={[styles.badge, { color: theme.muted }]} testID="badge-estimate">
          {formatEstimate(estimate)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginTop: 3, flexWrap: "wrap" },
  badge: { fontSize: 12 },
  priority: { fontWeight: "700" },
  slotToday: { fontWeight: "600" },
});
