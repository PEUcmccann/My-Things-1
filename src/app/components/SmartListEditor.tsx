import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  dateRanges,
  type ContainerRef,
  type EstimateChoice,
  type Priority,
  type SmartListFilters,
} from "../../core";
import { energyNames, priorityNames } from "../format";
import {
  dateRangeNames,
  estimateChoiceKey,
  estimateChoiceName,
  estimateChoices,
} from "../smartListText";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";

interface Props {
  id: string;
  onClose: () => void;
}

const priorityOrder: Priority[] = ["high", "medium", "low", "none"];

/** Values of one kind are compared by their content, so lists of objects can be toggled. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Picks a Smart List's filters. Each tap is saved straight away, so the list behind
 * the sheet updates as you go. Values that have been deleted show as such.
 */
export function SmartListEditor({ id, onClose }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const list = app.findSmartList(id);
  if (!list) return null;
  const { filters } = list;
  const gone = app.goneFromSmartList(id);

  function toggle<K extends keyof SmartListFilters>(
    kind: K,
    value: SmartListFilters[K][number],
  ): void {
    const values = filters[kind] as unknown[];
    const next = values.some((v) => same(v, value))
      ? values.filter((v) => !same(v, value))
      : [...values, value];
    app.setSmartListFilters(id, { ...filters, [kind]: next });
  }
  const isOn = <K extends keyof SmartListFilters>(kind: K, value: SmartListFilters[K][number]) =>
    (filters[kind] as unknown[]).some((v) => same(v, value));

  const chip = <K extends keyof SmartListFilters>(
    kind: K,
    value: SmartListFilters[K][number],
    title: string,
    testKey: string,
    opts: { gone?: boolean; icon?: IconName } = {},
  ) => (
    <Chip
      key={`${kind}-${testKey}`}
      title={title}
      on={isOn(kind, value)}
      gone={opts.gone}
      icon={opts.icon}
      onPress={() => toggle(kind, value)}
      testID={`smart-filter-${kind}-${testKey}`}
    />
  );

  const container = (ref: ContainerRef, title: string) =>
    chip("containers", ref, title, `${ref.kind}-${ref.id}`, { icon: ref.kind });
  const tree = app.sidebar();
  // Saved Estimate choices that are not among the presets still show, so they can be removed.
  const estimates: EstimateChoice[] = [
    ...estimateChoices,
    ...filters.estimate.filter((e) => !estimateChoices.some((p) => same(p, e))),
  ];

  return (
    <Sheet visible onClose={onClose} testID="smart-list-editor">
      <Text style={[styles.heading, { color: theme.text }]}>{list.title}</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>
        To-dos must match every kind you pick, and any one value within a kind.
      </Text>
      <ScrollView style={styles.scroll}>
        <Group title="Tags">
          {app.tagTree().map(({ tag }) => chip("tagIds", tag.id, tag.title, tag.id))}
          {gone.tagIds.map((t) => chip("tagIds", t, "Deleted Tag", t, { gone: true }))}
          {app.tagTree().length === 0 && gone.tagIds.length === 0 ? (
            <Text style={{ color: theme.muted }}>No Tags yet</Text>
          ) : null}
        </Group>
        <Group title="Areas and Projects">
          {tree.projects.map((p) => container({ kind: "project", id: p.id }, p.title))}
          {tree.areas.map(({ area, projects }) => [
            container({ kind: "area", id: area.id }, area.title),
            ...projects.map((p) => container({ kind: "project", id: p.id }, p.title)),
          ])}
          {gone.containers.map((c) =>
            chip(
              "containers",
              c,
              c.kind === "area" ? "Deleted Area" : "Deleted Project",
              `${c.kind}-${c.id}`,
              {
                gone: true,
              },
            ),
          )}
        </Group>
        <Group title="Start date">
          {dateRanges.map((r) => chip("startDate", r, dateRangeNames[r], r))}
        </Group>
        <Group title="Deadline">
          {dateRanges.map((r) => chip("deadline", r, dateRangeNames[r], r))}
        </Group>
        <Group title="Priority">
          {priorityOrder.map((p) => chip("priority", p, priorityNames[p], p))}
        </Group>
        <Group title="Energy">
          {chip("energy", "high", energyNames.high, "high")}
          {chip("energy", "low", energyNames.low, "low")}
          {chip("energy", null, "Not set", "notSet")}
        </Group>
        <Group title="Estimate">
          {estimates.map((e) => chip("estimate", e, estimateChoiceName(e), estimateChoiceKey(e)))}
        </Group>
      </ScrollView>
      <View style={styles.done}>
        <Button title="Done" kind="primary" onPress={onClose} testID="smart-list-editor-done" />
      </View>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.muted }]}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Chip(props: {
  title: string;
  on: boolean;
  gone?: boolean;
  icon?: IconName;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  const { on } = props;
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.chip,
        props.icon && styles.withIcon,
        { borderColor: on ? theme.accent : theme.border },
        on && { backgroundColor: theme.accent },
        props.gone && { borderStyle: "dashed" },
      ]}
      testID={props.testID}
      aria-checked={on}
      accessibilityRole="checkbox"
    >
      {props.icon ? (
        <Icon name={props.icon} size={14} color={on ? theme.onAccent : theme.muted} />
      ) : null}
      <Text
        style={[
          { color: on ? theme.onAccent : theme.text, fontSize: 14 },
          props.gone && styles.goneText,
        ]}
      >
        {props.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600" },
  hint: { fontSize: 13, marginTop: 4, marginBottom: 8 },
  scroll: { flexGrow: 0 },
  group: { marginTop: 12 },
  groupTitle: { fontSize: 13, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  withIcon: { flexDirection: "row", alignItems: "center", gap: 4 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  goneText: { fontStyle: "italic", textDecorationLine: "line-through" },
  done: { alignItems: "flex-end", marginTop: 12 },
});
