import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  lastDayOfMonth,
  weekday,
  weekdayCodes,
  type Frequency,
  type LocalDate,
  type RepeatMode,
  type RepeatPattern,
  type WeekdayCode,
} from "../../core";
import { dateParts, ordinal, repeatText, weekdayNames } from "../format";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Segmented } from "./Segmented";
import { Sheet } from "./Sheet";

interface Props {
  visible: boolean;
  /** The current rule, or null if the To-do doesn't repeat yet. */
  current: RepeatPattern | null;
  /** The current rule's mode; on schedule for a new rule. */
  currentMode: RepeatMode;
  /** The date a new rule's defaults (weekday, day of the month) come from. */
  from: LocalDate;
  onChoose: (pattern: RepeatPattern | null, mode: RepeatMode) => void;
  onClose: () => void;
}

const frequencyNames: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const unitNames: Record<Frequency, [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  yearly: ["year", "years"],
};

const modeOptions: { value: RepeatMode; title: string }[] = [
  { value: "onSchedule", title: "On schedule" },
  { value: "afterCompletion", title: "After completion" },
];

const monthDays = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Sets a Repeat rule: on schedule (how often, every N, and on which days) or after
 * completion (a gap of N days, weeks, months or years).
 */
export function RepeatPicker(props: Props) {
  if (!props.visible) return null;
  return <RepeatSheet {...props} />;
}

function RepeatSheet({ current, currentMode, from, onChoose, onClose }: Props) {
  const theme = useTheme();
  const [mode, setMode] = useState<RepeatMode>(currentMode);
  const [freq, setFreq] = useState<Frequency>(current?.freq ?? "daily");
  const [interval, setEvery] = useState(current?.interval ?? 1);
  const [byDay, setByDay] = useState<WeekdayCode[]>(
    current?.byDay?.length ? current.byDay : [weekdayCodes[weekday(from)]],
  );
  const [monthDay, setMonthDay] = useState(current?.byMonthDay?.[0] ?? dateParts(from).d);

  const pattern: RepeatPattern =
    mode === "afterCompletion"
      ? { freq, interval }
      : freq === "weekly"
        ? { freq, interval, byDay }
        : freq === "monthly"
          ? { freq, interval, byMonthDay: [monthDay] }
          : { freq, interval };
  const onSchedule = mode === "onSchedule";
  const valid = !onSchedule || freq !== "weekly" || byDay.length > 0;
  const choose = (next: RepeatPattern | null) => {
    onChoose(next, mode);
    onClose();
  };
  const toggleDay = (code: WeekdayCode) =>
    setByDay((days) => (days.includes(code) ? days.filter((d) => d !== code) : [...days, code]));

  const chip = (title: string, on: boolean, onPress: () => void, testID: string, wide = false) => (
    <Pressable
      key={testID}
      onPress={onPress}
      style={[
        styles.chip,
        wide && styles.wide,
        { borderColor: theme.border },
        on && { backgroundColor: theme.accent, borderColor: theme.accent },
      ]}
      accessibilityRole="checkbox"
      aria-checked={on}
      testID={testID}
    >
      <Text style={[styles.chipText, { color: on ? theme.onAccent : theme.text }]}>{title}</Text>
    </Pressable>
  );

  return (
    <Sheet visible onClose={onClose} testID="repeat-picker">
      <ScrollView>
        <Text style={[styles.heading, { color: theme.text }]}>Repeat</Text>
        <View style={styles.mode}>
          <Segmented options={modeOptions} value={mode} onChange={setMode} testID="repeat-mode" />
        </View>
        <View style={styles.row}>
          {(Object.keys(frequencyNames) as Frequency[]).map((f) =>
            chip(frequencyNames[f], freq === f, () => setFreq(f), `repeat-freq-${f}`, true),
          )}
        </View>
        <View style={[styles.row, styles.interval]}>
          <Text style={{ color: theme.text }}>Every</Text>
          <Button
            title="−"
            small
            disabled={interval <= 1}
            onPress={() => setEvery((n) => Math.max(1, n - 1))}
            testID="repeat-interval-less"
          />
          <Text style={[styles.count, { color: theme.text }]} testID="repeat-interval">
            {interval}
          </Text>
          <Button
            title="+"
            small
            disabled={interval >= 99}
            onPress={() => setEvery((n) => Math.min(99, n + 1))}
            testID="repeat-interval-more"
          />
          <Text style={{ color: theme.text }}>{unitNames[freq][interval === 1 ? 0 : 1]}</Text>
        </View>
        {onSchedule && freq === "weekly" ? (
          <View style={styles.row}>
            {weekdayCodes.map((code) =>
              chip(
                weekdayNames[code],
                byDay.includes(code),
                () => toggleDay(code),
                `repeat-day-${code}`,
              ),
            )}
          </View>
        ) : null}
        {onSchedule && freq === "monthly" ? (
          <>
            <View style={styles.row}>
              {monthDays.map((d) =>
                chip(String(d), monthDay === d, () => setMonthDay(d), `repeat-monthday-${d}`),
              )}
              {chip(
                "Last day",
                monthDay === lastDayOfMonth,
                () => setMonthDay(lastDayOfMonth),
                "repeat-monthday-last",
                true,
              )}
            </View>
            {monthDay >= 29 ? (
              <Text style={[styles.hint, { color: theme.muted }]} testID="repeat-month-hint">
                Months without a {ordinal(monthDay)} are skipped. Choose “Last day” to repeat at the
                end of every month.
              </Text>
            ) : null}
          </>
        ) : null}
        {onSchedule && freq === "yearly" ? (
          <Text style={[styles.hint, { color: theme.muted }]}>
            On the same day and month as the Start date.
          </Text>
        ) : null}
        <Text style={[styles.summary, { color: theme.text }]} testID="repeat-summary">
          {valid ? repeatText(pattern, from, mode) : "Choose at least one day."}
        </Text>
        {onSchedule ? null : (
          <Text style={[styles.hint, styles.after, { color: theme.muted }]}>
            The next one starts this long after the day you complete or cancel this one.
          </Text>
        )}
        <View style={styles.footer}>
          {current ? (
            <Button
              title="Don't repeat"
              kind="danger"
              onPress={() => choose(null)}
              testID="repeat-remove"
            />
          ) : (
            <View />
          )}
          <Button
            title="Save"
            kind="primary"
            disabled={!valid}
            onPress={() => choose(pattern)}
            testID="repeat-save"
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  mode: { marginBottom: 12 },
  after: { marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  interval: { alignItems: "center", gap: 10 },
  count: { fontSize: 18, fontWeight: "600", minWidth: 24, textAlign: "center" },
  chip: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  wide: { paddingHorizontal: 12 },
  chipText: { fontSize: 14, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 13, marginBottom: 12 },
  summary: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
});
