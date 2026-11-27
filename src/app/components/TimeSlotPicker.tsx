import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TimeSlot } from "../../core";
import { formatTime } from "../format";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface Props {
  visible: boolean;
  current: TimeSlot | null;
  /** The end to pre-fill once a start time is picked. */
  suggestEnd: (start: number) => number;
  /** A start time to offer when there is no slot yet. */
  defaultStart: number;
  onChoose: (slot: TimeSlot | null) => void;
  onClose: () => void;
}

type Edge = "start" | "end";

const hours = Array.from({ length: 24 }, (_, h) => h);
/** The picker moves in 5-minute steps. */
const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
const endOfDay = 24 * 60;

/** Picks a Time slot's start and end, or clears it. */
export function TimeSlotPicker(props: Props) {
  if (!props.visible) return null;
  return <SlotSheet {...props} />;
}

function SlotSheet({ current, suggestEnd, defaultStart, onChoose, onClose }: Props) {
  const theme = useTheme();
  const [start, setStart] = useState(current?.start ?? defaultStart);
  const [end, setEnd] = useState(current?.end ?? suggestEnd(current?.start ?? defaultStart));
  const [editing, setEditing] = useState<Edge>("start");
  const value = editing === "start" ? start : end;
  const valid = end > start && end <= endOfDay;

  const pick = (next: number) => {
    if (editing === "start") {
      const clamped = Math.min(next, endOfDay - 5);
      setStart(clamped);
      setEnd(suggestEnd(clamped));
    } else {
      setEnd(Math.min(next, endOfDay));
    }
  };
  const hourOf = Math.floor(value / 60);
  const minuteOf = value % 60;
  const choose = (slot: TimeSlot | null) => {
    onChoose(slot);
    onClose();
  };

  const chip = (key: string, title: string, on: boolean, onPress: () => void, testID: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: theme.border },
        on && { backgroundColor: theme.accent, borderColor: theme.accent },
      ]}
      accessibilityRole="radio"
      aria-checked={on}
      testID={testID}
    >
      <Text style={[styles.chipText, { color: on ? theme.onAccent : theme.text }]}>{title}</Text>
    </Pressable>
  );

  return (
    <Sheet visible onClose={onClose} testID="time-slot-picker">
      <Text style={[styles.heading, { color: theme.text }]}>Time slot</Text>
      <View style={styles.edges}>
        {(["start", "end"] as const).map((edge) => (
          <Pressable
            key={edge}
            onPress={() => setEditing(edge)}
            style={[styles.edge, { borderColor: editing === edge ? theme.accent : theme.border }]}
            accessibilityRole="tab"
            aria-selected={editing === edge}
            testID={`slot-edit-${edge}`}
          >
            <Text style={[styles.edgeLabel, { color: theme.muted }]}>
              {edge === "start" ? "Start" : "End"}
            </Text>
            <Text style={[styles.edgeTime, { color: theme.text }]} testID={`slot-${edge}`}>
              {formatTime(edge === "start" ? start : end)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.section, { color: theme.muted }]}>Hour</Text>
      <View style={styles.grid}>
        {hours.map((h) =>
          chip(
            `h${h}`,
            String(h).padStart(2, "0"),
            hourOf === h,
            () => pick(h * 60 + (hourOf < 24 ? minuteOf : 0)),
            `slot-hour-${h}`,
          ),
        )}
        {editing === "end"
          ? chip("h24", "24", hourOf === 24, () => pick(endOfDay), "slot-hour-24")
          : null}
      </View>
      <Text style={[styles.section, { color: theme.muted }]}>Minute</Text>
      <View style={styles.grid}>
        {minutes.map((m) =>
          chip(
            `m${m}`,
            String(m).padStart(2, "0"),
            hourOf < 24 && minuteOf === m,
            () => pick(Math.min(hourOf, 23) * 60 + m),
            `slot-minute-${m}`,
          ),
        )}
      </View>
      {valid ? null : (
        <Text style={[styles.error, { color: theme.danger }]} testID="slot-invalid">
          The end must be after the start.
        </Text>
      )}
      <View style={styles.footer}>
        <Button title="Clear" kind="danger" onPress={() => choose(null)} testID="slot-clear" />
        <Button
          title="Save"
          kind="primary"
          disabled={!valid}
          onPress={() => choose({ start, end })}
          testID="slot-save"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  edges: { flexDirection: "row", gap: 8, marginBottom: 12 },
  edge: { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 10, alignItems: "center" },
  edgeLabel: { fontSize: 13 },
  edgeTime: { fontSize: 22, fontWeight: "600", fontVariant: ["tabular-nums"] },
  section: { fontSize: 13, fontWeight: "600", marginTop: 4, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: {
    width: 44,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  chipText: { fontSize: 14, fontVariant: ["tabular-nums"] },
  error: { fontSize: 13, marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
});
