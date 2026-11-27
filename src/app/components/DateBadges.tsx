import { StyleSheet, Text, View } from "react-native";
import type { ToDo } from "../../core";
import { formatDate, timeSlotText } from "../format";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

/** The dates of a To-do or Project. Projects have no This Evening or Time slot. */
type Dated = Pick<ToDo, "startDate" | "deadline"> & {
  evening?: boolean;
  timeSlot?: ToDo["timeSlot"];
};

/** The Start date, Time slot and Deadline shown on a list row. */
export function DateBadges({ item: toDo, showStart = true }: { item: Dated; showStart?: boolean }) {
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
  if (!toDo.deadline && !slot && !(showStart && (startsLater || toDo.evening))) return null;
  return (
    <View style={styles.row}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginTop: 3, flexWrap: "wrap" },
  badge: { fontSize: 12 },
  slotToday: { fontWeight: "600" },
});
