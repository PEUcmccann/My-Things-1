import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Remaining } from "../../core";
import { haptics } from "../haptics";
import { useSelection } from "../selection";
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
  const ids = selection.ids.filter((id) => app.findToDo(id));
  const none = ids.length === 0;
  const close = () => setDialog(null);
  const done = () => selection.clear();

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
          onPress={() => setDialog("deadline")}
          testID="bulk-deadline"
        />
        <Button
          small
          title="Tags"
          disabled={none}
          onPress={() => {
            setTagIds([]);
            setDialog("tags");
          }}
          testID="bulk-tags"
        />
        <Button
          small
          title="Priority"
          disabled={none}
          onPress={() => setDialog("priority")}
          testID="bulk-priority"
        />
        <Button
          small
          title="Energy"
          disabled={none}
          onPress={() => setDialog("energy")}
          testID="bulk-energy"
        />
        <Button
          small
          title="Estimate"
          disabled={none}
          onPress={() => setDialog("estimate")}
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
        onChoose={(date) => {
          app.setDeadlineMany(ids, date);
          done();
        }}
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
          if (tagIds.length) {
            app.addTagsMany(ids, tagIds);
            done();
          }
          close();
        }}
      />
      <PriorityPicker
        visible={dialog === "priority"}
        onChoose={(priority) => {
          app.setPriorityMany(ids, priority);
          done();
        }}
        onClose={close}
      />
      <EnergyPicker
        visible={dialog === "energy"}
        onChoose={(energy) => {
          app.setEnergyMany(ids, energy);
          done();
        }}
        onClose={close}
      />
      <EstimatePicker
        visible={dialog === "estimate"}
        onChoose={(minutes) => {
          app.setEstimateMany(ids, minutes);
          done();
        }}
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
