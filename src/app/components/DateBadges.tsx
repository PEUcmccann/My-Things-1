import { StyleSheet, Text, View } from "react-native";
import type { ToDo } from "../../core";
import { formatDate } from "../format";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Icon } from "./Icon";

/** The dates of a To-do or Project. Projects have no This Evening. */
type Dated = Pick<ToDo, "startDate" | "deadline"> & { evening?: boolean };

/** The Start date and Deadline shown on a list row. */
export function DateBadges({ item: toDo, showStart = true }: { item: Dated; showStart?: boolean }) {
  const app = useMyThings();
  const theme = useTheme();
  const today = app.currentDate();
  const flag = app.deadlineFlag(toDo.deadline);
  const startsLater = toDo.startDate !== null && toDo.startDate > today;
  if (!toDo.deadline && !(showStart && (startsLater || toDo.evening))) return null;
  const deadlineColour = flag === "overdue" ? theme.danger : flag ? theme.warning : theme.muted;
  return (
    <View style={styles.row}>
      {showStart && toDo.evening ? (
        <View style={styles.badgeRow}>
          <Icon name="evening" size={12} color={theme.muted} />
          <Text style={[styles.badge, { color: theme.muted }]}>This Evening</Text>
        </View>
      ) : null}
      {showStart && startsLater ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginTop: 3, flexWrap: "wrap" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  badge: { fontSize: 12 },
});
