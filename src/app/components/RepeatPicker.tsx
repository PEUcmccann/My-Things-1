import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  byDayParts,
  lastDayOfMonth,
  weekday,
  weekdayCodes,
  workdayCodes,
  type ByDay,
  type Frequency,
  type LocalDate,
  type RepeatMode,
  type RepeatPattern,
  type WeekdayCode,
} from "../../core";
import { dateParts, formatDate, monthName, ordinal, repeatText, weekdayNames } from "../format";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Calendar } from "./Calendar";
import { Segmented } from "./Segmented";
import { Sheet } from "./Sheet";

interface Props {
  visible: boolean;
  /** The current rule, or null if the To-do doesn't repeat yet. */
  current: RepeatPattern | null;
  /** The current rule's mode; on schedule for a new rule. */
  currentMode: RepeatMode;
  /** The date a new rule's defaults (weekday, day of the month, month) come from. */
  from: LocalDate;
  today: LocalDate;
  /** The Start dates the series would have with this rule (empty if not known). */
  preview: (pattern: RepeatPattern, mode: RepeatMode) => LocalDate[];
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

/** Whether a monthly or yearly rule picks a day of the month or the nth weekday. */
type On = "day" | "weekday";
const onOptions: { value: On; title: string }[] = [
  { value: "day", title: "Day of the month" },
  { value: "weekday", title: "Weekday" },
];

type End = "never" | "count" | "until";
const endOptions: { value: End; title: string }[] = [
  { value: "never", title: "Never" },
  { value: "count", title: "After" },
  { value: "until", title: "On a date" },
];

/** The ordinals the picker offers: 1st to 4th, and last (which covers a 5th). */
const nths = [1, 2, 3, 4, -1];
/** The days an ordinal can pick: one weekday, or any weekday (Monday to Friday). */
type NthDay = WeekdayCode | "weekday";

const monthDays = Array.from({ length: 31 }, (_, i) => i + 1);
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const maxCount = 99;

/**
 * Sets a Repeat rule: on schedule (how often, every N, and on which days, such as
 * "the last weekday" or "the 2nd Tuesday of March") or after completion (a gap of N
 * days, weeks, months or years), and when it ends. It shows the rule in words and,
 * on schedule, its next dates.
 */
export function RepeatPicker(props: Props) {
  if (!props.visible) return null;
  return <RepeatSheet {...props} />;
}

/** The picker's starting choices, from the current rule or the `from` date. */
function initialChoices(current: RepeatPattern | null, from: LocalDate) {
  const byDay = (current?.byDay ?? []).map(byDayParts);
  const nthDay = byDay.find((d) => d.nth !== null);
  const bySetPos = current?.bySetPos?.[0];
  const inMonth = current?.freq === "monthly" || current?.freq === "yearly";
  return {
    weekdays: (current?.freq === "weekly" && byDay.length
      ? byDay.map((d) => d.code)
      : [weekdayCodes[weekday(from)]]) as WeekdayCode[],
    on: (inMonth && byDay.length ? "weekday" : "day") as On,
    monthDay: current?.byMonthDay?.[0] ?? dateParts(from).d,
    nth: bySetPos ?? nthDay?.nth ?? 1,
    nthDay: (bySetPos !== undefined
      ? "weekday"
      : (nthDay?.code ?? weekdayCodes[weekday(from)])) as NthDay,
    month: current?.byMonth?.[0] ?? dateParts(from).m,
    end: (current?.count !== undefined ? "count" : current?.until ? "until" : "never") as End,
    count: current?.count ?? 5,
    until: current?.until ?? null,
  };
}

function RepeatSheet({ current, currentMode, from, today, preview, onChoose, onClose }: Props) {
  const theme = useTheme();
  const [initial] = useState(() => initialChoices(current, from));
  const [mode, setMode] = useState<RepeatMode>(currentMode);
  const [freq, setFreq] = useState<Frequency>(current?.freq ?? "daily");
  const [interval, setEvery] = useState(current?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<WeekdayCode[]>(initial.weekdays);
  const [on, setOn] = useState<On>(initial.on);
  const [monthDay, setMonthDay] = useState(initial.monthDay);
  const [nth, setNth] = useState(initial.nth);
  const [nthDay, setNthDay] = useState<NthDay>(initial.nthDay);
  const [month, setMonth] = useState(initial.month);
  const [end, setEnd] = useState<End>(initial.end);
  const [count, setCount] = useState(initial.count);
  const [until, setUntil] = useState<LocalDate | null>(initial.until);

  const onSchedule = mode === "onSchedule";
  const inMonth = onSchedule && (freq === "monthly" || freq === "yearly");
  const days: Partial<RepeatPattern> =
    on === "day"
      ? { byMonthDay: [monthDay] }
      : nthDay === "weekday"
        ? { byDay: [...workdayCodes], bySetPos: [nth] }
        : { byDay: [`${nth}${nthDay}` as ByDay] };
  const ending: Partial<RepeatPattern> =
    end === "count" ? { count } : end === "until" && until ? { until } : {};
  const pattern: RepeatPattern = {
    freq,
    interval,
    ...(!onSchedule
      ? {}
      : freq === "weekly"
        ? { byDay: weekdays }
        : freq === "monthly"
          ? days
          : freq === "yearly"
            ? { byMonth: [month], ...days }
            : {}),
    ...ending,
  };
  const problem =
    onSchedule && freq === "weekly" && !weekdays.length
      ? "Choose at least one day."
      : end === "until" && !until
        ? "Choose the date it ends."
        : null;
  const dates = problem ? [] : preview(pattern, mode);
  const noDates = !problem && onSchedule && !dates.length;
  const valid = !problem && !noDates;

  const choose = (next: RepeatPattern | null) => {
    onChoose(next, mode);
    onClose();
  };
  const toggleDay = (code: WeekdayCode) =>
    setWeekdays((list) => (list.includes(code) ? list.filter((d) => d !== code) : [...list, code]));

  const chip = (
    title: string,
    isOn: boolean,
    onPress: () => void,
    testID: string,
    wide = false,
  ) => (
    <Pressable
      key={testID}
      onPress={onPress}
      style={[
        styles.chip,
        wide && styles.wide,
        { borderColor: theme.border },
        isOn && { backgroundColor: theme.accent, borderColor: theme.accent },
      ]}
      accessibilityRole="checkbox"
      aria-checked={isOn}
      testID={testID}
    >
      <Text style={[styles.chipText, { color: isOn ? theme.onAccent : theme.text }]}>{title}</Text>
    </Pressable>
  );
  const stepper = (
    value: number,
    set: (fn: (n: number) => number) => void,
    max: number,
    testID: string,
  ) => (
    <>
      <Button
        title="−"
        small
        disabled={value <= 1}
        onPress={() => set((n) => Math.max(1, n - 1))}
        testID={`${testID}-less`}
      />
      <Text style={[styles.count, { color: theme.text }]} testID={testID}>
        {value}
      </Text>
      <Button
        title="+"
        small
        disabled={value >= max}
        onPress={() => set((n) => Math.min(max, n + 1))}
        testID={`${testID}-more`}
      />
    </>
  );

  return (
    <Sheet visible onClose={onClose} testID="repeat-picker">
      <ScrollView>
        <Text style={[styles.heading, { color: theme.text }]}>Repeat</Text>
        <View style={styles.block}>
          <Segmented options={modeOptions} value={mode} onChange={setMode} testID="repeat-mode" />
        </View>
        <View style={styles.row}>
          {(Object.keys(frequencyNames) as Frequency[]).map((f) =>
            chip(frequencyNames[f], freq === f, () => setFreq(f), `repeat-freq-${f}`, true),
          )}
        </View>
        <View style={[styles.row, styles.inline]}>
          <Text style={{ color: theme.text }}>Every</Text>
          {stepper(interval, setEvery, 99, "repeat-interval")}
          <Text style={{ color: theme.text }}>{unitNames[freq][interval === 1 ? 0 : 1]}</Text>
        </View>
        {onSchedule && freq === "weekly" ? (
          <View style={styles.row}>
            {weekdayCodes.map((code) =>
              chip(
                weekdayNames[code],
                weekdays.includes(code),
                () => toggleDay(code),
                `repeat-day-${code}`,
              ),
            )}
          </View>
        ) : null}
        {onSchedule && freq === "yearly" ? (
          <View style={styles.row}>
            {months.map((m) =>
              chip(monthName(m), month === m, () => setMonth(m), `repeat-month-${m}`),
            )}
          </View>
        ) : null}
        {inMonth ? (
          <View style={styles.block}>
            <Segmented options={onOptions} value={on} onChange={setOn} testID="repeat-on" />
          </View>
        ) : null}
        {inMonth && on === "day" ? (
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
        {inMonth && on === "weekday" ? (
          <>
            <View style={styles.row}>
              {nths.map((n) =>
                chip(
                  n < 0 ? "Last" : ordinal(n),
                  nth === n,
                  () => setNth(n),
                  `repeat-nth-${n < 0 ? "last" : n}`,
                  true,
                ),
              )}
            </View>
            <View style={styles.row}>
              {weekdayCodes.map((code) =>
                chip(
                  weekdayNames[code],
                  nthDay === code,
                  () => setNthDay(code),
                  `repeat-nthday-${code}`,
                ),
              )}
              {chip(
                "Weekday",
                nthDay === "weekday",
                () => setNthDay("weekday"),
                "repeat-nthday-weekday",
                true,
              )}
            </View>
          </>
        ) : null}
        <Text style={[styles.label, { color: theme.muted }]}>Ends</Text>
        <View style={styles.block}>
          <Segmented options={endOptions} value={end} onChange={setEnd} testID="repeat-end" />
        </View>
        {end === "count" ? (
          <View style={[styles.row, styles.inline]}>
            {stepper(count, setCount, maxCount, "repeat-count")}
            <Text style={{ color: theme.text }}>{count === 1 ? "time" : "times"}</Text>
          </View>
        ) : null}
        {end === "count" ? (
          <Text style={[styles.hint, { color: theme.muted }]}>
            Counting every occurrence so far, this one included.
          </Text>
        ) : null}
        {end === "until" ? (
          <View style={styles.block}>
            <Calendar today={today} selected={until} onSelect={setUntil} />
          </View>
        ) : null}
        <Text style={[styles.summary, { color: theme.text }]} testID="repeat-summary">
          {problem ?? repeatText(pattern, from, mode)}
        </Text>
        {onSchedule ? (
          <View style={styles.preview} testID="repeat-preview">
            {noDates ? (
              <Text style={{ color: theme.muted }}>This rule has no dates.</Text>
            ) : (
              dates.map((date, i) => (
                <Text key={date} style={{ color: theme.muted }} testID={`repeat-preview-${i}`}>
                  {formatDate(date, today)}
                </Text>
              ))
            )}
          </View>
        ) : (
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
  block: { marginBottom: 12 },
  after: { marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  inline: { alignItems: "center", gap: 10 },
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
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  hint: { fontSize: 13, marginBottom: 12 },
  summary: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  preview: { marginTop: 6, gap: 2 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
});
