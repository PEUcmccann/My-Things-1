import { StyleSheet, Text, View } from "react-native";
import { formatEstimate, type ToDo } from "../../core";
import { energyIcons, energyNames, formatDate, priorityMarks, timeSlotText } from "../format";
import { useMyThings } from "../state";
import { useTheme, type Theme } from "../theme";
import { Icon } from "./Icon";

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
  const deadlineColour = flag === "overdue" ? theme.danger : flag ? theme.warning : theme.muted;
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
        <View style={styles.badgeRow}>
          <Icon name="evening" size={12} color={theme.muted} />
          <Text style={[styles.badge, { color: theme.muted }]}>This Evening</Text>
        </View>
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
        <View style={styles.badgeRow} testID={flag ? `deadline-flag-${flag}` : undefined}>
          {flag ? <Icon name="deadline" size={12} color={deadlineColour} /> : null}
          <Text style={[styles.badge, { color: deadlineColour }]}>
            Deadline {formatDate(toDo.deadline, today)}
          </Text>
        </View>
      ) : null}
      {energy ? (
        <View style={styles.badgeRow}>
          {energyIcons[energy] ? (
            <Icon name={energyIcons[energy]} size={12} color={theme.muted} />
          ) : null}
          <Text style={[styles.badge, { color: theme.muted }]} testID="badge-energy">
            {energyNames[energy]}
          </Text>
        </View>
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
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  badge: { fontSize: 12 },
  priority: { fontWeight: "700" },
  slotToday: { fontWeight: "600" },
});
