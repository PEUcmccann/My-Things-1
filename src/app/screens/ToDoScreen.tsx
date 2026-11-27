import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { formatEstimate, type MyThings, type SeriesScope, type ToDo } from "../../core";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { ChecklistEditor } from "../components/ChecklistEditor";
import { FieldRow } from "../components/FieldRow";
import type { IconName } from "../components/Icon";
import { MovePicker } from "../components/MovePicker";
import { NotesField } from "../components/NotesField";
import { EnergyPicker, EstimatePicker, PriorityPicker } from "../components/PlanningPickers";
import { RepeatPicker } from "../components/RepeatPicker";
import { Screen } from "../components/Screen";
import { SeriesScopeChoice } from "../components/SeriesScopeChoice";
import { TagPicker } from "../components/TagPicker";
import { ToDoList } from "../components/ToDoList";
import { TimeSlotPicker } from "../components/TimeSlotPicker";
import { DatePicker, WhenPicker } from "../components/WhenPicker";
import { useFinishToDo } from "../finish";
import {
  energyIcons,
  energyNames,
  formatDate,
  priorityMarks,
  priorityNames,
  repeatText,
  timeSlotText,
  whenIcon,
  whenText,
} from "../format";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

/** Where the To-do is filed, for the Move row. */
function place(app: MyThings, toDo: ToDo): { text: string; icon?: IconName } {
  if (toDo.projectId) {
    const project = app.findProject(toDo.projectId)?.title ?? "Project";
    const heading = toDo.headingId ? ` › ${app.getHeading(toDo.headingId).title}` : "";
    return { text: `${project}${heading}`, icon: "project" };
  }
  if (toDo.areaId) return { text: app.findArea(toDo.areaId)?.title ?? "Area", icon: "area" };
  return toDo.startDate || toDo.someday
    ? { text: "No Area or Project" }
    : { text: "Inbox", icon: "inbox" };
}

type Picker =
  | "when"
  | "repeat"
  | "timeSlot"
  | "deadline"
  | "move"
  | "tags"
  | "priority"
  | "energy"
  | "estimate"
  | null;

function priorityText(toDo: ToDo): string {
  if (toDo.priority === "none") return "None";
  return `${priorityMarks[toDo.priority]} ${priorityNames[toDo.priority]}`;
}

/** The next whole hour from now, as a first start time to offer (23:00 at the latest). */
function nextHour(): number {
  return Math.min((new Date().getHours() + 1) * 60, 23 * 60);
}

export function ToDoScreen({ id }: { id: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const finish = useFinishToDo();
  const toDo = app.findToDo(id);
  const [title, setTitle] = useState(toDo?.title ?? "");
  const [newChild, setNewChild] = useState("");
  const [picker, setPicker] = useState<Picker>(null);
  // A repeating To-do asks "this one or all future ones" once per visit, at the
  // first edit that needs it; the answer holds for the rest of the visit.
  const [scope, setScope] = useState<SeriesScope | null>(null);
  const [asking, setAsking] = useState<{ then: (scope: SeriesScope) => void } | null>(null);
  // Remounts the fields after backing out, so text being edited goes back too.
  const [fieldsKey, setFieldsKey] = useState(0);

  if (!toDo) {
    return (
      <Screen title="To-do">
        <Text style={{ color: theme.muted }}>This To-do no longer exists.</Text>
      </Screen>
    );
  }
  const today = app.currentDate();
  const where = place(app, toDo);
  const trashed = app.isInTrash(id);
  const parent = toDo.parentId ? app.findToDo(toDo.parentId) : undefined;
  const children = toDo.parentId
    ? []
    : app.subToDos(id).map((t) => ({ toDo: t, parentTitle: null }));
  const repeat = app.repeatPatternOf(id);
  // A new rule's first date is on or after the Start date, or today if that has passed.
  const repeatFrom = toDo.startDate && toDo.startDate > today ? toDo.startDate : today;

  /** Asks "this one or all future ones" first, when this visit hasn't yet. */
  const ask = (then: (scope: SeriesScope | null) => void) => {
    if (!app.asksThisOneOrAllFuture(id) || scope) then(scope);
    else if (!asking) setAsking({ then });
  };
  /** Makes an edit to something the next occurrence copies. */
  const edit = (change: () => void) =>
    ask((s) => (s ? app.editOccurrence(id, s, change) : change()));
  /** Opens a picker for something the next occurrence copies, asking first. */
  const openPicker = (p: Picker) => ask(() => setPicker(p));
  const answer = (s: SeriesScope) => {
    const then = asking?.then;
    setAsking(null);
    setScope(s);
    // iOS cannot show another sheet (a picker) while this one is still sliding away.
    if (Platform.OS === "ios") setTimeout(() => then?.(s), 450);
    else then?.(s);
  };
  const backOut = () => {
    setAsking(null);
    setTitle(toDo.title);
    setFieldsKey((k) => k + 1);
  };

  const saveTitle = () => {
    if (title.trim() && title.trim() !== toDo.title) edit(() => app.editToDo(id, { title }));
  };
  const addChild = () => {
    if (!newChild.trim()) return;
    edit(() => app.createToDo({ title: newChild.trim(), parentId: id }));
    setNewChild("");
  };

  return (
    <Screen title={parent ? "Sub-to-do" : "To-do"} testID="screen-todo">
      {parent ? (
        <Pressable
          onPress={() => nav.push({ name: "toDo", id: parent.id })}
          style={styles.parent}
          testID="todo-parent"
        >
          <Text style={{ color: theme.muted }}>↳ in {parent.title}</Text>
        </Pressable>
      ) : null}
      <View style={styles.titleRow}>
        <Checkbox
          outcome={toDo.outcome}
          onPress={() => (toDo.outcome === "active" ? finish(id, "completed") : app.reopen(id))}
          testID="todo-detail-check"
        />
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={saveTitle}
          onSubmitEditing={saveTitle}
          style={[styles.title, { color: theme.text, borderColor: theme.border }]}
          testID="todo-title"
          accessibilityLabel="Title"
        />
      </View>
      <View style={styles.fields} key={fieldsKey}>
        <NotesField
          value={toDo.notes}
          onSave={(notes) => edit(() => app.editToDo(id, { notes }))}
        />
        <ChecklistEditor toDoId={id} edit={edit} />
        <FieldRow
          label="When"
          value={whenText(toDo, today)}
          icon={whenIcon(toDo, today)}
          onPress={() => setPicker("when")}
          testID="todo-when"
        />
        {parent ? null : (
          <FieldRow
            label="Repeat"
            icon={repeat ? "repeat" : undefined}
            value={
              repeat && toDo.repeat
                ? repeatText(repeat, toDo.repeat.start, toDo.repeat.mode)
                : "None"
            }
            onPress={() => setPicker("repeat")}
            testID="todo-repeat"
          />
        )}
        <FieldRow
          label="Time slot"
          value={timeSlotText(toDo, today) ?? "None"}
          onPress={() => openPicker("timeSlot")}
          testID="todo-time-slot"
        />
        <FieldRow
          label="Deadline"
          value={toDo.deadline ? formatDate(toDo.deadline, today) : "None"}
          onPress={() => openPicker("deadline")}
          testID="todo-deadline"
        />
        <FieldRow
          label="Tags"
          value={
            app
              .tagsOf({ kind: "toDo", id })
              .map((t) => t.title)
              .join(", ") || "None"
          }
          onPress={() => openPicker("tags")}
          testID="todo-tags"
        />
        <FieldRow
          label="Priority"
          value={priorityText(toDo)}
          onPress={() => openPicker("priority")}
          testID="todo-priority"
        />
        <FieldRow
          label="Energy"
          value={toDo.energy ? energyNames[toDo.energy] : "None"}
          icon={toDo.energy ? energyIcons[toDo.energy] : undefined}
          iconColor={theme.muted}
          onPress={() => openPicker("energy")}
          testID="todo-energy"
        />
        <FieldRow
          label="Estimate"
          value={toDo.estimate ? formatEstimate(toDo.estimate) : "None"}
          onPress={() => openPicker("estimate")}
          testID="todo-estimate"
        />
        {parent ? null : (
          <FieldRow
            label="Move"
            value={where.text}
            icon={where.icon}
            iconColor={where.icon === "inbox" ? undefined : theme.muted}
            onPress={() => setPicker("move")}
            testID="todo-move"
          />
        )}
      </View>

      {parent ? null : (
        <View style={styles.children} testID="sub-todos">
          <Text style={[styles.section, { color: theme.muted }]}>Sub-to-dos</Text>
          <ToDoList entries={children} />
          <TextInput
            value={newChild}
            onChangeText={setNewChild}
            onSubmitEditing={addChild}
            blurOnSubmit={false}
            placeholder="Add Sub-to-do"
            placeholderTextColor={theme.muted}
            style={[styles.newChild, { color: theme.text, borderColor: theme.border }]}
            testID="sub-todo-new"
          />
        </View>
      )}

      <View style={styles.actions}>
        {toDo.outcome === "active" ? (
          <>
            <Button
              title="Complete"
              onPress={() => finish(id, "completed")}
              testID="todo-complete"
            />
            <Button
              title="Cancel To-do"
              onPress={() => finish(id, "cancelled")}
              testID="todo-cancel"
            />
          </>
        ) : (
          <Button
            title={toDo.outcome === "completed" ? "Reopen (Completed)" : "Reopen (Cancelled)"}
            onPress={() => app.reopen(id)}
            testID="todo-reopen"
          />
        )}
        {parent ? (
          <Button title="Promote to To-do" onPress={() => app.promote(id)} testID="todo-promote" />
        ) : null}
        {trashed ? (
          <Button
            title="Restore from Trash"
            onPress={() => app.restore(id)}
            testID="todo-restore"
          />
        ) : (
          <Button
            title="Delete"
            kind="danger"
            onPress={() => {
              app.delete(id);
              nav.back();
            }}
            testID="todo-delete"
          />
        )}
      </View>
      <TagPicker
        visible={picker === "tags"}
        selected={toDo.tagIds}
        onToggle={(tagId, on) =>
          edit(() =>
            on
              ? app.addTag({ kind: "toDo", id }, tagId)
              : app.removeTag({ kind: "toDo", id }, tagId),
          )
        }
        onClose={() => setPicker(null)}
      />
      <PriorityPicker
        visible={picker === "priority"}
        onChoose={(priority) => edit(() => app.setPriority(id, priority))}
        onClose={() => setPicker(null)}
      />
      <EnergyPicker
        visible={picker === "energy"}
        onChoose={(energy) => edit(() => app.setEnergy(id, energy))}
        onClose={() => setPicker(null)}
      />
      <EstimatePicker
        visible={picker === "estimate"}
        onChoose={(minutes) => edit(() => app.setEstimate(id, minutes))}
        onClose={() => setPicker(null)}
      />
      <MovePicker
        visible={picker === "move"}
        onChoose={(to) => app.moveToDo(id, to)}
        onClose={() => setPicker(null)}
      />
      <WhenPicker
        visible={picker === "when"}
        current={toDo.startDate}
        allowUndated={!toDo.repeat}
        onChoose={(when) => app.setWhen(id, when)}
        onClose={() => setPicker(null)}
      />
      <RepeatPicker
        visible={picker === "repeat"}
        current={repeat}
        currentMode={toDo.repeat?.mode ?? "onSchedule"}
        from={repeatFrom}
        today={today}
        preview={(pattern, mode) => app.repeatPreview(id, pattern, mode)}
        onChoose={(pattern, mode) => app.setRepeat(id, pattern, mode)}
        onClose={() => setPicker(null)}
      />
      <TimeSlotPicker
        visible={picker === "timeSlot"}
        current={toDo.timeSlot}
        suggestEnd={(start) => app.suggestedSlotEnd(id, start)}
        defaultStart={nextHour()}
        onChoose={(slot) => edit(() => app.setTimeSlot(id, slot))}
        onClose={() => setPicker(null)}
      />
      <DatePicker
        visible={picker === "deadline"}
        title="Deadline"
        current={toDo.deadline}
        onChoose={(date) => edit(() => app.setDeadline(id, date))}
        onClose={() => setPicker(null)}
        testID="deadline-picker"
      />
      <SeriesScopeChoice visible={asking !== null} onChoose={answer} onBackOut={backOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  parent: { marginLeft: 8, marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  fields: { marginTop: 16, gap: 8 },
  children: { marginTop: 20 },
  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
    marginLeft: 8,
  },
  newChild: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 15 },
});
