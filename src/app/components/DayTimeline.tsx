import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native";
import type { DayTimeline as Timeline, TimelineEntry } from "../../core";
import { formatTime } from "../format";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

/** Height of one hour on the timeline. */
const hourHeight = 64;
const perMinute = hourHeight / 60;
/** Width of the hour labels at the left. */
const gutter = 52;
/** So a short slot can still be read and tapped. */
const minBlockHeight = 24;

/** Re-reads the timeline every half minute, so the current time moves on. */
function useTimeline(): Timeline {
  const app = useMyThings();
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  return app.dayTimeline();
}

/** Today hour by hour, with each To-do's Time slot as a block. */
export function DayTimeline() {
  const theme = useTheme();
  const { from, to, now, entries } = useTimeline();
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);
  const y = (minutes: number) => (minutes - from) * perMinute;
  const hours: number[] = [];
  for (let m = from; m <= to; m += 60) hours.push(m);
  const showNow = now >= from && now <= to;

  return (
    <ScrollView
      ref={scroll}
      contentContainerStyle={styles.content}
      testID="timeline"
      onContentSizeChange={() => {
        // Opens at the current hour.
        if (scrolled.current) return;
        scrolled.current = true;
        const hour = Math.floor(now / 60) * 60;
        scroll.current?.scrollTo({ y: Math.max(0, y(hour) - 8), animated: false });
      }}
    >
      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          No Time slots today. Give a To-do a Time slot in its detail.
        </Text>
      ) : null}
      <View style={{ height: y(to) + 16 }}>
        {hours.map((m) => (
          <View key={m} style={[styles.hour, { top: y(m) }]} pointerEvents="none">
            <Text style={[styles.hourLabel, { color: theme.muted }]}>{formatTime(m)}</Text>
            <View style={[styles.hourLine, { backgroundColor: theme.border }]} />
          </View>
        ))}
        <View style={styles.lanes}>
          {entries.map((e) => (
            <Block key={`${e.kind}-${e.toDo.id}`} entry={e} top={y(e.start)} />
          ))}
        </View>
        {showNow ? (
          <View
            style={[styles.now, { top: y(now) - 1 }]}
            pointerEvents="none"
            testID="timeline-now"
            accessibilityLabel={`Now, ${formatTime(now)}`}
          >
            <View style={[styles.nowDot, { backgroundColor: theme.danger }]} />
            <View style={[styles.nowLine, { backgroundColor: theme.danger }]} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Block({ entry, top }: { entry: TimelineEntry; top: number }) {
  const theme = useTheme();
  const nav = useNavigation();
  const { toDo, parentTitle, start, end, lane, lanes } = entry;
  const finished = toDo.outcome !== "active";
  const height = Math.max((end - start) * perMinute - 2, minBlockHeight);
  const times = `${formatTime(start)}–${formatTime(end)}`;
  const colour = finished ? theme.muted : theme.accent;
  // Short blocks put the time beside the title, or leave it out (it is in the
  // accessibility label) when they share the width with others.
  const roomy = height >= 44;
  return (
    <Pressable
      onPress={() => nav.push({ name: "toDo", id: toDo.id })}
      accessibilityRole="button"
      accessibilityLabel={`${toDo.title}, ${times}`}
      testID={`timeline-block-${toDo.id}`}
      style={[
        styles.block,
        {
          top,
          height,
          left: `${(lane / lanes) * 100}%`,
          width: `${100 / lanes}%`,
        },
      ]}
    >
      <View
        style={[
          styles.blockInner,
          { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: colour },
          !roomy && styles.blockRow,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colour, opacity: 0.12 }]} />
        {roomy && parentTitle ? (
          <Text style={[styles.parent, { color: theme.muted }]} numberOfLines={1}>
            ↳ {parentTitle}
          </Text>
        ) : null}
        <Text
          style={[
            styles.blockTitle,
            { color: finished ? theme.muted : theme.text },
            finished && styles.struck,
            !roomy && styles.shrink,
          ]}
          numberOfLines={roomy ? 2 : 1}
          testID={finished ? `finished-${toDo.outcome}` : undefined}
        >
          {toDo.title}
        </Text>
        {roomy || lanes === 1 ? (
          <Text
            style={[styles.blockTime, { color: theme.muted }]}
            numberOfLines={1}
            testID="timeline-time"
          >
            {times}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 120 },
  empty: { fontSize: 14, marginBottom: 12, marginLeft: 4 },
  hour: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center" },
  hourLabel: { width: gutter, fontSize: 12, marginTop: -1, fontVariant: ["tabular-nums"] },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth },
  lanes: { position: "absolute", top: 0, bottom: 0, left: gutter, right: 0 },
  block: { position: "absolute", paddingRight: 3, paddingTop: 1 },
  blockInner: {
    flex: 1,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: "hidden",
  },
  blockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  parent: { fontSize: 11 },
  blockTitle: { fontSize: 14, fontWeight: "600" },
  shrink: { flexShrink: 1 },
  blockTime: { fontSize: 12, fontVariant: ["tabular-nums"] },
  struck: { textDecorationLine: "line-through" },
  now: {
    position: "absolute",
    left: gutter - 5,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  nowDot: { width: 9, height: 9, borderRadius: 5 },
  nowLine: { flex: 1, height: 2 },
});
