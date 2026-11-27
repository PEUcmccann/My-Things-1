import { StyleSheet, Text, View } from "react-native";
import type { LocalDate, When } from "../../core";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Calendar } from "./Calendar";
import { Sheet } from "./Sheet";

interface Props {
  visible: boolean;
  current: LocalDate | null;
  onChoose: (when: When) => void;
  onClose: () => void;
  /** Projects have no This Evening. */
  allowEvening?: boolean;
  /** Repeating To-dos always have a Start date: no Someday and no Clear. */
  allowUndated?: boolean;
}

/** The "When" picker: Today, This Evening, a date, Someday, or none. */
export function WhenPicker({
  visible,
  current,
  onChoose,
  onClose,
  allowEvening = true,
  allowUndated = true,
}: Props) {
  const app = useMyThings();
  const theme = useTheme();
  if (!visible) return null;
  const choose = (when: When) => {
    onChoose(when);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} testID="when-picker">
      <Text style={[styles.heading, { color: theme.text }]}>When</Text>
      <View style={styles.options}>
        <Button
          title="Today"
          icon="today"
          iconColor={theme.icons.today}
          onPress={() => choose({ kind: "today" })}
          testID="when-today"
        />
        {allowEvening ? (
          <Button
            title="This Evening"
            icon="evening"
            onPress={() => choose({ kind: "thisEvening" })}
            testID="when-evening"
          />
        ) : null}
        <Button
          title="Tomorrow"
          onPress={() => choose({ kind: "date", date: app.tomorrow() })}
          testID="when-tomorrow"
        />
        {allowUndated ? (
          <Button
            title="Someday"
            icon="someday"
            iconColor={theme.icons.someday}
            onPress={() => choose({ kind: "someday" })}
            testID="when-someday"
          />
        ) : null}
      </View>
      <Calendar
        today={app.currentDate()}
        selected={current}
        onSelect={(date) => choose({ kind: "date", date })}
      />
      {allowUndated ? (
        <View style={styles.footer}>
          <Button
            title="Clear"
            kind="danger"
            onPress={() => choose({ kind: "none" })}
            testID="when-clear"
          />
        </View>
      ) : (
        <Text style={[styles.note, { color: theme.muted }]} testID="when-repeat-note">
          A repeating To-do always has a Start date.
        </Text>
      )}
    </Sheet>
  );
}

interface DateProps {
  visible: boolean;
  title: string;
  current: LocalDate | null;
  onChoose: (date: LocalDate | null) => void;
  onClose: () => void;
  testID?: string;
}

/** Picks a single date, as for a Deadline. */
export function DatePicker({ visible, title, current, onChoose, onClose, testID }: DateProps) {
  const app = useMyThings();
  const theme = useTheme();
  if (!visible) return null;
  const choose = (date: LocalDate | null) => {
    onChoose(date);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} testID={testID}>
      <Text style={[styles.heading, { color: theme.text }]}>{title}</Text>
      <Calendar today={app.currentDate()} selected={current} onSelect={choose} />
      <View style={styles.footer}>
        <Button title="Clear" kind="danger" onPress={() => choose(null)} testID="date-clear" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  footer: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  note: { fontSize: 13, marginTop: 12 },
});
