import type { Context } from "./context";
import { addDays, daysBetween } from "./dates";
import { checkPattern, formatRrule, nextRepeatDate, parseRrule, type RepeatPattern } from "./rrule";
import { eraseToDoFrom } from "./trash";
import type { LocalDate, RepeatRule, ToDo } from "./types";

/**
 * Repeat rules. Only the current occurrence of a repeating To-do carries the rule.
 * Finishing it (Completed or Cancelled) creates the next occurrence, which takes
 * the rule over; every occurrence shares a series id.
 */

function later(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

function shifted(date: LocalDate | null, days: number): LocalDate | null {
  return date && addDays(date, days);
}

/** The next occurrence's Start date, or null when the series ends. */
function nextOccurrenceDate(rule: RepeatRule, current: ToDo, today: LocalDate): LocalDate | null {
  switch (rule.mode) {
    case "onSchedule": {
      // Completing late skips missed dates; completing early never lands on the same date.
      const after = later(current.startDate ?? today, today);
      return nextRepeatDate(parseRrule(rule.rrule), rule.start, after);
    }
  }
}

/** A copy of a To-do as a fresh, active record with `changes` applied. */
function copyToDo(ctx: Context, from: ToDo, changes: Partial<ToDo>): string {
  const meta = ctx.meta();
  ctx.store.put("toDos", {
    ...from,
    ...meta,
    outcome: "active",
    finishedAt: null,
    loggedAt: null,
    todayPosition: null,
    deletedAt: null,
    tagIds: [...from.tagIds],
    timeSlot: from.timeSlot && { ...from.timeSlot },
    ...changes,
  });
  return meta.id;
}

/**
 * One step of copying a finished occurrence to the next one, which is `days` later.
 * Reminders (Milestone 4) add a step here that shifts them by `days`; attachments
 * (Milestone 3) are left out.
 */
type CopyStep = (ctx: Context, from: ToDo, toId: string, days: number) => void;

const copyChecklist: CopyStep = (ctx, from, toId) => {
  for (const item of ctx.store.all("checklistItems")) {
    if (item.toDoId !== from.id) continue;
    ctx.store.put("checklistItems", { ...item, ...ctx.meta(), toDoId: toId, ticked: false });
  }
};

/** What a Sub-to-do's copy takes along. */
const subToDoSteps: CopyStep[] = [copyChecklist];

/** Every Sub-to-do not in the Trash, reopened (even Cancelled ones), with its dates shifted. */
const copySubToDos: CopyStep = (ctx, from, toId, days) => {
  const parent = ctx.require("toDos", toId);
  for (const child of ctx.store.all("toDos")) {
    if (child.parentId !== from.id || child.deletedAt) continue;
    const copyId = copyToDo(ctx, child, {
      parentId: toId,
      areaId: parent.areaId,
      projectId: parent.projectId,
      headingId: parent.headingId,
      startDate: shifted(child.startDate, days),
      deadline: shifted(child.deadline, days),
      timeSlot: child.startDate ? child.timeSlot && { ...child.timeSlot } : null,
    });
    for (const step of subToDoSteps) step(ctx, child, copyId, days);
  }
};

/** What the next occurrence takes along, beyond the To-do's own fields. */
const occurrenceSteps: CopyStep[] = [copyChecklist, copySubToDos];

/**
 * Creates the next occurrence of a repeating To-do that has just been finished. It
 * copies the Checklist (unticked), Sub-to-dos (reopened), Tags, planning
 * attributes, Time slot and notes, in the same place, and takes the rule over.
 */
export function createNextOccurrence(ctx: Context, id: string): string | null {
  const current = ctx.require("toDos", id);
  const rule = current.repeat;
  if (!rule) return null;
  const today = ctx.clock.today();
  const date = nextOccurrenceDate(rule, current, today);
  ctx.update("toDos", id, { repeat: null });
  if (!date) return null;
  const days = daysBetween(current.startDate ?? today, date);
  const nextId = copyToDo(ctx, current, {
    startDate: date,
    deadline: shifted(current.deadline, days),
    someday: false,
    repeat: { ...rule },
  });
  for (const step of occurrenceSteps) step(ctx, current, nextId, days);
  return nextId;
}

/** The open occurrence of a series: active, carrying the rule, not in the Trash. */
function openOccurrence(ctx: Context, seriesId: string): ToDo | undefined {
  return ctx.store
    .all("toDos")
    .find(
      (t) => t.seriesId === seriesId && t.repeat && t.outcome === "active" && !ctx.isTrashed(t),
    );
}

/** The most recently finished occurrence of a series. */
function latestFinished(ctx: Context, seriesId: string): ToDo | undefined {
  const finished = ctx.store
    .all("toDos")
    .filter((t) => t.seriesId === seriesId && t.outcome !== "active" && !t.deletedAt);
  finished.sort(
    (a, b) =>
      (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") ||
      b.createdAt.localeCompare(a.createdAt),
  );
  return finished[0];
}

/**
 * The rule-side of reopening a finished occurrence, before it becomes active. The
 * latest one acts as an undo: the open next occurrence is removed for good and the
 * reopened To-do carries the rule again. Any other becomes a normal To-do.
 */
export function reopenOccurrence(ctx: Context, id: string): void {
  const item = ctx.require("toDos", id);
  if (!item.seriesId || item.repeat || item.outcome === "active") return;
  const open = openOccurrence(ctx, item.seriesId);
  if (open && latestFinished(ctx, item.seriesId)?.id === id) {
    ctx.update("toDos", id, { repeat: open.repeat });
    eraseToDoFrom(ctx.store, open.id);
  } else {
    ctx.update("toDos", id, { seriesId: null });
  }
}

/** Whether "When" can clear a To-do's Start date: not while it has a Repeat rule. */
export function checkCanBeUndated(item: ToDo): void {
  if (item.repeat) throw new Error("A repeating To-do always has a Start date");
}

export function repeatActions(ctx: Context) {
  const { clock } = ctx;
  return {
    /**
     * Sets, changes or removes (null) a To-do's Repeat rule on schedule. Its Start
     * date moves to the rule's first date on or after its Start date (or today, if
     * it has none or it has passed), which becomes the rule's start.
     */
    setRepeat(id: string, pattern: RepeatPattern | null): void {
      const item = ctx.require("toDos", id);
      if (pattern === null) {
        ctx.update("toDos", id, { repeat: null, seriesId: null });
        return;
      }
      if (item.parentId) throw new Error("A Sub-to-do can't have a Repeat rule of its own");
      checkPattern(pattern);
      const from = later(item.startDate ?? clock.today(), clock.today());
      // The first date matches the rule's days; the interval counts from there.
      const start = nextRepeatDate({ ...pattern, interval: 1 }, from, addDays(from, -1));
      if (!start) throw new Error("This Repeat rule has no dates");
      ctx.update("toDos", id, {
        repeat: { mode: "onSchedule", rrule: formatRrule(pattern), start },
        seriesId: item.seriesId ?? ctx.meta().id,
        startDate: start,
        someday: false,
        evening: start === item.startDate && item.evening,
      });
    },

    /** A To-do's Repeat rule as its parts, or null if it doesn't repeat. */
    repeatPatternOf(id: string): RepeatPattern | null {
      const rule = ctx.require("toDos", id).repeat;
      return rule ? parseRrule(rule.rrule) : null;
    },

    /** The open occurrence of the series this To-do belongs to, if there is one. */
    currentOccurrence(id: string): ToDo | undefined {
      const item = ctx.require("toDos", id);
      if (!item.seriesId) return undefined;
      return openOccurrence(ctx, item.seriesId);
    },
  };
}
