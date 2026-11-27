import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addDays, startOfMonth, startOfWeek, type LocalDate } from "../../core";
import { dateParts, formatMonth } from "../format";
import { useTheme } from "../theme";

interface Props {
  today: LocalDate;
  selected: LocalDate | null;
  onSelect: (date: LocalDate) => void;
}

function shiftMonth(month: LocalDate, by: number): LocalDate {
  const { y, m } = dateParts(month);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** A month grid for choosing a day. Weeks start on Monday. */
export function Calendar({ today, selected, onSelect }: Props) {
  const theme = useTheme();
  const [month, setMonth] = useState(startOfMonth(selected ?? today));
  const first = startOfWeek(month);
  const weeks: LocalDate[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d));
    if (w > 0 && week[0].slice(0, 7) !== month.slice(0, 7)) break;
    weeks.push(week);
  }
  return (
    <View testID="calendar">
      <View style={styles.header}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10} testID="cal-prev">
          <Text style={[styles.nav, { color: theme.accent }]}>‹</Text>
        </Pressable>
        <Text style={[styles.month, { color: theme.text }]}>{formatMonth(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={10} testID="cal-next">
          <Text style={[styles.nav, { color: theme.accent }]}>›</Text>
        </Pressable>
      </View>
      <View style={styles.week}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <Text key={i} style={[styles.cell, styles.dayName, { color: theme.muted }]}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((date) => {
            const inMonth = date.slice(0, 7) === month.slice(0, 7);
            const isSelected = date === selected;
            const isToday = date === today;
            return (
              <Pressable
                key={date}
                onPress={() => onSelect(date)}
                style={[styles.cell, isSelected && { backgroundColor: theme.accent }]}
                testID={`cal-${date}`}
                accessibilityLabel={date}
              >
                <Text
                  style={{
                    color: isSelected ? theme.onAccent : isToday ? theme.accent : theme.text,
                    opacity: inMonth ? 1 : 0.35,
                    fontWeight: isToday ? "700" : "400",
                  }}
                >
                  {dateParts(date).d}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  nav: { fontSize: 26, paddingHorizontal: 12 },
  month: { fontSize: 16, fontWeight: "600" },
  week: { flexDirection: "row" },
  cell: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    textAlign: "center",
  },
  dayName: { fontSize: 12, lineHeight: 36 },
});
