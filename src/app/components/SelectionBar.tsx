import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Remaining, SeriesScope } from "../../core";
import { haptics } from "../haptics";
import { useSelection } from "../selection";
import { useAskSeriesScope } from "../seriesScope";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { MovePicker } from "./MovePicker";
import { EnergyPicker, EstimatePicker, PriorityPicker } from "./PlanningPickers";
import { RemainingChoice } from "./RemainingChoice";
import { TagPicker } from "./TagPicker";
import { DatePicker, WhenPicker } from "./WhenPicker";

type Dialog =
  | "move"
  | "when"
  | "deadline"
  | "tags"
  | "priority"
  | "energy"
  | "estimate"
  | { finish: "complete" | "cancel" }
  | null;

/** The actions for the selected To-dos, shown instead of Magic Plus while selecting. */
export function SelectionBar() {
  const app = useMyThings();
  const theme = useTheme();
  const selection = useSelection();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const askScope = useAskSeriesScope();
  // The answer to "this one or all future ones" for the action being made.
  const [scope, setScope] = useState<SeriesScope | null>(null);
  const ids = selection.ids.filter((id) => app.findToDo(id));
  const none = ids.length === 0;
  const close = () => setDialog(null);
  const done = () => selection.clear();

  /**
   * Opens the picker for an action on fields the next occurrence copies. When the
   * selection has a repeating To-do, it asks once first, for the whole action.
   */
  const openSeriesEdit = (d: Dialog) =>
    askScope(ids, (s) => {
      setScope(s);
      setDialog(d);
    });
  /** Makes the action, with the answer for each repeating To-do in the selection. */
  const editSeries = (change: () => void) => {
    if (scope) app.editOccurrences(ids, scope, change);
    else change();
    done();
  };

  const finish = (what: "complete" | "cancel", remaining?: Remaining) => {
    if (what === "complete") app.completeMany(ids, { remaining });
    else app.cancelMany(ids, { remaining });
    haptics.success();
    done();
  };
  const askFinish = (what: "complete" | "cancel") =>
    app.bulkNeedsRemainingChoice(ids) ? setDialog({ finish: what }) : finish(what);
  const finishing = dialog && typeof dialog === "object" ? dialog.finish : null;

  return (
    <View
      style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID="selection-bar"
    >
      <View style={styles.top}>
        <Text style={[styles.count, { color: theme.text }]} testID="selection-count">
          {ids.length} selected
        </Text>
        <Button small title="Done" kind="primary" onPress={done} testID="selection-done" />
      </View>
      <ScrollView horizontal contentContainerStyle={styles.actions}>
        <Button
          small
          title="Move"
          disabled={none}
          onPress={() => setDialog("move")}
          testID="bulk-move"
        />
        <Button
          small
          title="When"
          disabled={none}
          onPress={() => setDialog("when")}
          testID="bulk-when"
        />
        <Button
          small
          title="Deadline"
          disabled={none}
          onPress={() => openSeriesEdit("deadline")}
          testID="bulk-deadline"
        />
        <Button
          small
          title="Tags"
          disabled={none}
          onPress={() => {
            setTagIds([]);
            openSeriesEdit("tags");
          }}
          testID="bulk-tags"
        />
        <Button
          small
          title="Priority"
          disabled={none}
          onPress={() => openSeriesEdit("priority")}
          testID="bulk-priority"
        />
        <Button
          small
          title="Energy"
          disabled={none}
          onPress={() => openSeriesEdit("energy")}
          testID="bulk-energy"
        />
        <Button
          small
          title="Estimate"
          disabled={none}
          onPress={() => openSeriesEdit("estimate")}
          testID="bulk-estimate"
        />
        <Button
          small
          title="Complete"
          disabled={none}
          onPress={() => askFinish("complete")}
          testID="bulk-complete"
        />
        <Button
          small
          title="Cancel"
          disabled={none}
          onPress={() => askFinish("cancel")}
          testID="bulk-cancel"
        />
        <Button
          small
          title="Delete"
          kind="danger"
          disabled={none}
          onPress={() => {
            app.deleteMany(ids);
            done();
          }}
          testID="bulk-delete"
        />
      </ScrollView>
      <MovePicker
        visible={dialog === "move"}
        onChoose={(to) => {
          app.moveMany(ids, to);
          done();
        }}
        onClose={close}
      />
      <WhenPicker
        visible={dialog === "when"}
        current={null}
        allowUndated={!ids.some((id) => app.findToDo(id)?.repeat)}
        onChoose={(when) => {
          app.setWhenMany(ids, when);
          done();
        }}
        onClose={close}
      />
      <DatePicker
        visible={dialog === "deadline"}
        title="Deadline"
        current={null}
        onChoose={(date) => editSeries(() => app.setDeadlineMany(ids, date))}
        onClose={close}
      />
      <TagPicker
        visible={dialog === "tags"}
        title="Add Tags"
        selected={tagIds}
        onToggle={(tagId, on) =>
          setTagIds((t) => (on ? [...t, tagId] : t.filter((x) => x !== tagId)))
        }
        onClose={() => {
          if (tagIds.length) editSeries(() => app.addTagsMany(ids, tagIds));
          close();
        }}
      />
      <PriorityPicker
        visible={dialog === "priority"}
        onChoose={(priority) => editSeries(() => app.setPriorityMany(ids, priority))}
        onClose={close}
      />
      <EnergyPicker
        visible={dialog === "energy"}
        onChoose={(energy) => editSeries(() => app.setEnergyMany(ids, energy))}
        onClose={close}
      />
      <EstimatePicker
        visible={dialog === "estimate"}
        onChoose={(minutes) => editSeries(() => app.setEstimateMany(ids, minutes))}
        onClose={close}
      />
      <RemainingChoice
        visible={finishing !== null}
        title={finishing === "complete" ? "Complete selected" : "Cancel selected"}
        message="Some of them have open Sub-to-dos that are not selected."
        onChoose={(remaining) => finish(finishing!, remaining)}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  count: { flex: 1, fontSize: 15, fontWeight: "600" },
  actions: { gap: 6 },
});
