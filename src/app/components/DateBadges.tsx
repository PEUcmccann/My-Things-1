import { StyleSheet, Text, View } from "react-native";
import type { ToDo } from "../../core";
import { formatDate } from "../format";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

/** The Start date and Deadline shown on a list row. */
export function DateBadges({ toDo, showStart = true }: { toDo: ToDo; showStart?: boolean }) {
  const app = useMyThings();
  const theme = useTheme();
  const today = app.currentDate();
  const flag = app.deadlineFlag(toDo.deadline);
  const startsLater = toDo.startDate !== null && toDo.startDate > today;
  if (!toDo.deadline && !(showStart && (startsLater || toDo.evening))) return null;
  return (
    <View style={styles.row}>
      {showStart && toDo.evening ? (
        <Text style={[styles.badge, { color: theme.muted }]}>🌙 This Evening</Text>
      ) : null}
      {showStart && startsLater ? (
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
});
